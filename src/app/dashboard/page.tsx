"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Navigation } from "@/components/Navigation";
import { 
  subscribeToTasks, 
  addTask, 
  updateTaskStatus, 
  deleteTask, 
  Task 
} from "@/lib/services/tasks";
import { 
  getAttendanceForDates, 
  setAttendance 
} from "@/lib/services/attendance";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendanceState] = useState<Record<string, string>>({});
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<Task["category"]>("Native");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Generate last 7 days ending today
  const last7Days = useMemo(() => {
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" }); // "Mon", "Tue"
      const dayInitial = d.toLocaleDateString("en-US", { weekday: "narrow" }); // "M", "T"
      list.push({ dateStr, dayLabel, dayInitial });
    }
    return list;
  }, []);

  // Fetch Attendance data
  const fetchAttendance = useCallback(async () => {
    if (!user) return;
    const dates = last7Days.map(d => d.dateStr);
    const records = await getAttendanceForDates(user.uid, dates);
    setAttendanceState(records);
  }, [user, last7Days]);

  // Subscribe to tasks
  useEffect(() => {
    if (!user) return;
    
    fetchAttendance();
    const unsubscribe = subscribeToTasks(user.uid, (fetchedTasks) => {
      setTasks(fetchedTasks);
    });

    return () => unsubscribe();
  }, [user, fetchAttendance]);

  // Cycle Attendance Status: none -> present -> absent -> none
  const toggleAttendance = async (dateStr: string) => {
    if (!user) return;
    const current = attendance[dateStr] || "none";
    let nextStatus: "present" | "absent" | "none" = "present";

    if (current === "present") nextStatus = "absent";
    else if (current === "absent") nextStatus = "none";

    // Optimistic UI update
    setAttendanceState(prev => ({ ...prev, [dateStr]: nextStatus }));

    try {
      await setAttendance(user.uid, dateStr, nextStatus);
    } catch (error) {
      console.error("Failed to update attendance:", error);
      fetchAttendance(); // Rollback to actual db state
    }
  };

  // Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskTitle.trim()) return;

    try {
      await addTask({
        userId: user.uid,
        title: newTaskTitle,
        description: newTaskDesc,
        dueDate: newTaskDueDate ? new Date(newTaskDueDate) : new Date(),
        category: newTaskCategory,
        status: "todo",
        source: "native",
      });

      // Reset Form & Close Modal
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskCategory("Native");
      setNewTaskDueDate("");
      setIsQuickAddOpen(false);
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  // Task drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: Task["status"]) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      await updateTaskStatus(taskId, newStatus);
    } catch (error) {
      console.error("Failed to update task status:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Calculate Up Next Class from active tasks
  const nextClass = useMemo(() => {
    // Find next pending class (Gmail/Coursera event) sorted by due date
    const classes = tasks.filter(t => 
      t.status === "todo" && 
      (t.category === "Gmail" || t.category === "Coursera" || t.title.toLowerCase().includes("class") || t.title.toLowerCase().includes("lecture")) &&
      t.dueDate && new Date(t.dueDate) >= new Date()
    );
    return classes.length > 0 ? classes[0] : null;
  }, [tasks]);

  // Filtered Tasks for Search
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    return tasks.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tasks, searchQuery]);

  // Split tasks by column for Kanban
  const todoTasks = useMemo(() => filteredTasks.filter(t => t.status === "todo"), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter(t => t.status === "in_progress"), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter(t => t.status === "done"), [filteredTasks]);

  // Active tasks for mobile screen count
  const activeMobileTasks = useMemo(() => tasks.filter(t => t.status !== "done"), [tasks]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-on-surface">
        <div className="flex flex-col items-center gap-md">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          <span className="font-label-md text-label-md tracking-wider">LOADING StudySync...</span>
        </div>
      </div>
    );
  }

  // Format today's date for mobile header
  const formattedToday = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return (
    <Navigation activeTab="home">
      {/* TopNavBar (Desktop & Mobile Unified) */}
      <header className="bg-surface top-0 border-b border-outline-variant z-10 shrink-0">
        <div className="flex justify-between items-center w-full px-md h-16 max-w-[1200px] mx-auto">
          {/* Mobile brand header */}
          <div className="flex items-center gap-sm md:hidden">
            <span className="font-h2 text-h2 text-primary font-bold">StudySync</span>
          </div>

          {/* Search (Desktop only) */}
          <div className="flex-1 max-w-md hidden md:flex">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                className="w-full bg-surface-container text-on-surface font-body-md text-body-md rounded pl-10 pr-4 py-2 border border-outline-variant focus:border-primary focus:outline-none transition-colors"
                placeholder="Search tasks..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-md ml-auto">
            <button className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer p-2 rounded hover:bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded hover:bg-primary-container transition-colors flex items-center gap-xs cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="hidden sm:inline">Quick Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-md md:p-xl">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-xl">
          
          {/* Mobile Header (Date view) */}
          <div className="flex justify-between items-center mb-md md:hidden">
            <div className="flex flex-col">
              <span className="font-h2 text-h2 text-on-surface font-bold tracking-tight">Today</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{formattedToday}</span>
            </div>
            <img
              alt="User avatar"
              className="w-10 h-10 rounded-full object-cover border border-outline-variant"
              src={user.photoURL || "https://lh3.googleusercontent.com/..."}
            />
          </div>

          {/* Top Row: Up Next Widget & Attendance Tracker */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            
            {/* Up Next Widget */}
            <div className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant p-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md relative overflow-hidden group">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary opacity-5 rounded-full blur-3xl pointer-events-none transition-opacity group-hover:opacity-10"></div>
              <div>
                <div className="flex items-center gap-xs mb-sm">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                  <span className="font-label-sm text-label-sm text-error uppercase tracking-wider">Live Now</span>
                </div>
                {nextClass ? (
                  <>
                    <h2 className="font-h1 text-h1 text-on-surface mb-xs truncate max-w-[320px] sm:max-w-[400px]">
                      {nextClass.title}
                    </h2>
                    <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      Due {nextClass.dueDate ? new Date(nextClass.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "No time"}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-h1 text-h1 text-on-surface mb-xs">No Live Classes</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      Sync Coursera ICS or Gmail to view live sessions.
                    </p>
                  </>
                )}
              </div>
              {nextClass && (
                <button 
                  onClick={() => router.push(nextClass.description.includes("http") ? nextClass.description : "/calendar")}
                  className="bg-[#507DBC] text-white font-label-md text-label-md px-6 py-3 rounded-lg hover:bg-[#436ca3] transition-colors shrink-0 shadow-sm flex items-center gap-sm cursor-pointer"
                >
                  Join Class
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              )}
            </div>

            {/* Attendance Widget */}
            <div className="bg-surface rounded-xl border border-outline-variant p-lg flex flex-col">
              <div className="flex items-center justify-between mb-md pb-xs border-b border-outline-variant">
                <h3 className="font-h3 text-h3 text-on-surface">Attendance</h3>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Last 7 Days</span>
              </div>
              <div className="flex justify-between items-center mt-auto gap-1">
                {last7Days.map((day) => {
                  const status = attendance[day.dateStr] || "none";
                  return (
                    <div 
                      key={day.dateStr} 
                      onClick={() => toggleAttendance(day.dateStr)}
                      className="flex flex-col items-center gap-xs cursor-pointer group flex-1 select-none"
                    >
                      <span className="font-label-sm text-label-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                        {day.dayInitial}
                      </span>
                      {status === "present" && (
                        <div className="w-8 h-8 rounded-full bg-secondary-container border border-secondary flex items-center justify-center text-secondary transition-all">
                          <span className="material-symbols-outlined text-[14px]">check</span>
                        </div>
                      )}
                      {status === "absent" && (
                        <div className="w-8 h-8 rounded-full bg-error-container/20 border border-error flex items-center justify-center text-error transition-all">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </div>
                      )}
                      {status === "none" && (
                        <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant group-hover:border-primary transition-all"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Kanban Board (Desktop View) */}
          <div className="hidden md:flex flex-col min-h-[400px] mt-md">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-h2 text-h2 text-on-surface font-semibold">Tasks</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-lg flex-1">
              
              {/* To-Do Column */}
              <div 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "todo")}
                className="flex flex-col bg-surface-container-low rounded-xl border border-outline-variant p-sm min-h-[350px] kanban-col overflow-y-auto"
              >
                <div className="flex items-center justify-between px-xs py-sm mb-sm sticky top-0 bg-surface-container-low z-10 border-b border-outline-variant">
                  <div className="flex items-center gap-sm">
                    <div className="w-2 h-2 rounded-full bg-outline"></div>
                    <span className="font-label-md text-label-md text-on-surface">To-Do</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-full">
                    {todoTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-sm">
                  {todoTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="bg-surface p-md rounded border border-outline-variant hover:border-primary transition-all duration-200 cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex justify-between items-start mb-sm">
                        <span className={`font-label-sm text-label-sm px-2 py-1 rounded-full ${
                          task.category === 'Coursera' ? 'text-primary bg-primary/10' :
                          task.category === 'Gmail' ? 'text-tertiary bg-tertiary/10' :
                          task.category === 'Notion' ? 'text-on-surface bg-surface-variant' :
                          'text-secondary bg-secondary/10'
                        }`}>
                          {task.category}
                        </span>
                        <div className="flex items-center gap-xs">
                          <button 
                            onClick={async () => await deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all p-1 rounded hover:bg-surface-container-high cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                            {task.category === 'Coursera' ? 'school' :
                             task.category === 'Gmail' ? 'mail' :
                             task.category === 'Notion' ? 'description' :
                             task.category === 'Project' ? 'code' : 'book'}
                          </span>
                        </div>
                      </div>
                      <h4 className="font-h3 text-h3 text-on-surface mb-xs leading-tight font-semibold">{task.title}</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mb-xs truncate">{task.description}</p>
                      <div className="flex items-center gap-xs text-error mt-sm">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        <span className="font-label-sm text-label-sm">
                          {task.dueDate ? task.dueDate.toLocaleDateString() : "No date"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {todoTasks.length === 0 && (
                    <div className="border border-dashed border-outline-variant/60 rounded p-md text-center text-on-surface-variant text-body-sm">
                      No pending tasks
                    </div>
                  )}
                </div>
              </div>

              {/* In Progress Column */}
              <div 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "in_progress")}
                className="flex flex-col bg-surface-container-low rounded-xl border border-outline-variant p-sm min-h-[350px] kanban-col overflow-y-auto"
              >
                <div className="flex items-center justify-between px-xs py-sm mb-sm sticky top-0 bg-surface-container-low z-10 border-b border-outline-variant">
                  <div className="flex items-center gap-sm">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span className="font-label-md text-label-md text-on-surface">In Progress</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-full">
                    {inProgressTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-sm">
                  {inProgressTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="bg-surface p-md rounded border border-outline-variant hover:border-primary transition-all duration-200 cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex justify-between items-start mb-sm">
                        <span className={`font-label-sm text-label-sm px-2 py-1 rounded-full ${
                          task.category === 'Coursera' ? 'text-primary bg-primary/10' :
                          task.category === 'Gmail' ? 'text-tertiary bg-tertiary/10' :
                          task.category === 'Notion' ? 'text-on-surface bg-surface-variant' :
                          'text-secondary bg-secondary/10'
                        }`}>
                          {task.category}
                        </span>
                        <div className="flex items-center gap-xs">
                          <button 
                            onClick={async () => await deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all p-1 rounded hover:bg-surface-container-high cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                            {task.category === 'Coursera' ? 'school' :
                             task.category === 'Gmail' ? 'mail' :
                             task.category === 'Notion' ? 'description' :
                             task.category === 'Project' ? 'code' : 'book'}
                          </span>
                        </div>
                      </div>
                      <h4 className="font-h3 text-h3 text-on-surface mb-xs leading-tight font-semibold">{task.title}</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mb-xs truncate">{task.description}</p>
                      <div className="w-full bg-surface-variant h-1 rounded-full mt-sm overflow-hidden">
                        <div className="bg-primary h-full w-[50%]"></div>
                      </div>
                    </div>
                  ))}
                  {inProgressTasks.length === 0 && (
                    <div className="border border-dashed border-outline-variant/60 rounded p-md text-center text-on-surface-variant text-body-sm">
                      Drag tasks here
                    </div>
                  )}
                </div>
              </div>

              {/* Done Column */}
              <div 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "done")}
                className="flex flex-col bg-surface-container-low rounded-xl border border-outline-variant p-sm min-h-[350px] kanban-col overflow-y-auto"
              >
                <div className="flex items-center justify-between px-xs py-sm mb-sm sticky top-0 bg-surface-container-low z-10 border-b border-outline-variant">
                  <div className="flex items-center gap-sm">
                    <div className="w-2 h-2 rounded-full bg-secondary"></div>
                    <span className="font-label-md text-label-md text-on-surface">Done</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-full">
                    {doneTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-sm">
                  {doneTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="bg-surface p-md rounded border border-outline-variant hover:border-primary transition-all duration-200 cursor-grab active:cursor-grabbing group relative opacity-70"
                    >
                      <div className="flex justify-between items-start mb-sm">
                        <span className="font-label-sm text-label-sm text-secondary bg-secondary/10 px-2 py-1 rounded-full">
                          Done
                        </span>
                        <button 
                          onClick={async () => await deleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all p-1 rounded hover:bg-surface-container-high cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                      <h4 className="font-h3 text-h3 text-on-surface mb-xs leading-tight font-semibold line-through">{task.title}</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mb-xs truncate line-through">{task.description}</p>
                    </div>
                  ))}
                  {doneTasks.length === 0 && (
                    <div className="border border-dashed border-outline-variant/60 rounded p-md text-center text-on-surface-variant text-body-sm">
                      Drop tasks here
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Mobile Tasks List (Mobile View) */}
          <section className="md:hidden mt-md">
            <div className="flex justify-between items-center mb-sm border-b border-outline-variant pb-xs">
              <h3 className="font-label-md text-label-md text-on-surface-variant">ACTIVE TASKS</h3>
              <span className="font-label-sm text-label-sm bg-surface-container-high px-xs py-1 rounded text-on-surface">
                {activeMobileTasks.length} Active
              </span>
            </div>
            
            <div className="flex flex-col gap-base">
              {activeMobileTasks.map((task) => (
                <div 
                  key={task.id}
                  onClick={async () => await updateTaskStatus(task.id, task.status === 'todo' ? 'in_progress' : 'done')}
                  className="flex items-start gap-md p-sm bg-surface rounded border border-outline-variant hover:border-primary transition-all duration-200 cursor-pointer group"
                >
                  <div className="mt-xs">
                    <div className={`w-4 h-4 rounded-sm border border-outline-variant group-hover:border-primary transition-colors flex items-center justify-center ${
                      task.status === 'in_progress' ? 'bg-primary/20 border-primary' : ''
                    }`}>
                      {task.status === 'in_progress' && (
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-body-md text-body-md text-on-surface mb-xs font-semibold">{task.title}</p>
                    <div className="flex items-center gap-xs text-on-surface-variant font-label-sm text-label-sm">
                      <span className="material-symbols-outlined text-[14px]">
                        {task.category === 'Coursera' ? 'school' :
                         task.category === 'Gmail' ? 'mail' :
                         task.category === 'Notion' ? 'description' :
                         task.category === 'Project' ? 'code' : 'book'}
                      </span> 
                      {task.category}
                    </div>
                  </div>
                </div>
              ))}
              {activeMobileTasks.length === 0 && (
                <div className="border border-dashed border-outline-variant/60 rounded p-lg text-center text-on-surface-variant text-body-sm mt-sm">
                  All done! Enjoy your day.
                </div>
              )}
            </div>
          </section>

        </div>
      </main>

      {/* Floating Action Button (Mobile View only) */}
      <button 
        onClick={() => setIsQuickAddOpen(true)}
        className="md:hidden fixed bottom-[88px] right-margin-mobile w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-40 border border-[#2E2E2E] cursor-pointer"
      >
        <span className="material-symbols-outlined text-[24px]">add</span>
      </button>

      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container rounded-xl border border-outline-variant w-full max-w-md p-lg relative shadow-xl">
            <button 
              onClick={() => setIsQuickAddOpen(false)}
              className="absolute top-sm right-sm text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h3 className="font-h2 text-h2 text-on-surface mb-md pb-xs border-b border-outline-variant font-semibold">
              Add New Task
            </h3>
            
            <form onSubmit={handleAddTask} className="flex flex-col gap-md">
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">Title</label>
                <input 
                  type="text"
                  required
                  placeholder="Task title..."
                  className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">Description</label>
                <textarea 
                  placeholder="Task details..."
                  className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none h-20 resize-none"
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant">Category</label>
                  <select 
                    className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none"
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as Task["category"])}
                  >
                    <option value="Native">Native</option>
                    <option value="Coursera">Coursera</option>
                    <option value="Project">Project</option>
                    <option value="Gmail">Gmail</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant">Due Date</label>
                  <input 
                    type="date"
                    required
                    className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="bg-[#507DBC] text-white hover:bg-[#436ca3] font-label-md text-label-md py-md rounded-lg mt-sm transition-all cursor-pointer text-center font-semibold"
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}
    </Navigation>
  );
}
