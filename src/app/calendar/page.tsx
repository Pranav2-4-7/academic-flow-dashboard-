"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Navigation } from "@/components/Navigation";
import { 
  subscribeToTasks, 
  addTask, 
  deleteTask, 
  updateTask,
  Task 
} from "@/lib/services/tasks";

export default function Calendar() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  
  // Backlog state
  const [newBacklogTitle, setNewBacklogTitle] = useState("");
  const [newBacklogCategory, setNewBacklogCategory] = useState<Task["category"]>("Native");

  // New Event Modal/Inline states
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [newEventCategory, setNewEventCategory] = useState<Task["category"]>("Native");
  const [newEventTime, setNewEventTime] = useState("10:00");

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Subscribe to tasks
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTasks(user.uid, (fetchedTasks) => {
      setTasks(fetchedTasks);
    });
    return () => unsubscribe();
  }, [user]);

  // Current Month/Year calculations
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  // Generate calendar grid days
  const calendarCells = useMemo(() => {
    const cells = [];
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Find preceding days from the previous month to fill week beginning on Monday
    const dayOfWeek = firstDay.getDay(); // 0-6 (Sun=0)
    const precedingCount = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    // Push preceding days
    for (let i = precedingCount - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Push current month days
    const currentMonthLastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= currentMonthLastDay; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Push following days to complete a 35 or 42 grid cell format
    const totalCells = cells.length > 35 ? 42 : 35;
    const followingCount = totalCells - cells.length;
    for (let i = 1; i <= followingCount; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [year, month]);

  // Check if two dates represent the same day
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  // Get tasks for a given date
  const getTasksForDate = useCallback((date: Date) => {
    return tasks.filter((t) => t.dueDate && isSameDay(t.dueDate, date));
  }, [tasks]);

  // Unscheduled tasks filter
  const unscheduledTasks = useMemo(() => {
    return tasks.filter((t) => !t.dueDate);
  }, [tasks]);

  // Selected Day Tasks
  const selectedDayTasks = useMemo(() => {
    return getTasksForDate(selectedDate);
  }, [selectedDate, getTasksForDate]);

  // Month string name
  const monthName = currentMonthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Add Backlog Task (Unscheduled)
  const handleAddBacklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBacklogTitle.trim()) return;

    try {
      await addTask({
        userId: user.uid,
        title: newBacklogTitle.trim(),
        description: "Backlog task added directly from calendar inbox",
        dueDate: null, // No date initially!
        category: newBacklogCategory,
        status: "todo",
        source: "native",
      });
      setNewBacklogTitle("");
    } catch (error) {
      console.error("Failed to add backlog task:", error);
    }
  };

  // Drag and Drop: Move Task to target cell date
  const handleMoveTaskToDate = async (taskId: string, targetDate: Date) => {
    try {
      const originalTask = tasks.find((t) => t.id === taskId);
      const newDueDate = new Date(targetDate);
      
      if (originalTask && originalTask.dueDate) {
        // Keep original timestamp hours
        newDueDate.setHours(originalTask.dueDate.getHours(), originalTask.dueDate.getMinutes(), 0, 0);
      } else {
        newDueDate.setHours(10, 0, 0, 0); // Default to 10:00 AM
      }
      
      await updateTask(taskId, { dueDate: newDueDate });
    } catch (error) {
      console.error("Failed to reschedule task:", error);
    }
  };

  // Drag and Drop: Drag task back to backlog (remove dueDate)
  const handleUnscheduleTask = async (taskId: string) => {
    try {
      await updateTask(taskId, { dueDate: null });
    } catch (error) {
      console.error("Failed to unschedule task:", error);
    }
  };

  // Handle Event submit (Selected Day Side Panel)
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEventTitle.trim()) return;

    try {
      const fullDueDate = new Date(selectedDate);
      const [hours, minutes] = newEventTime.split(":");
      fullDueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await addTask({
        userId: user.uid,
        title: newEventTitle.trim(),
        description: newEventDesc.trim(),
        dueDate: fullDueDate,
        category: newEventCategory,
        status: "todo",
        source: "native",
      });

      setNewEventTitle("");
      setNewEventDesc("");
      setIsAddEventOpen(false);
    } catch (error) {
      console.error("Failed to add event:", error);
    }
  };

  return (
    <Navigation activeTab="calendar">
      <div className="flex h-screen w-full flex-col lg:flex-row overflow-hidden">
        
        {/* Calendar Grid Section */}
        <div className="flex-1 flex flex-col p-lg lg:p-xl h-full overflow-y-auto">
          
          {/* 1. Top Panel: Courses Backlog (Unscheduled Drop Zone) */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => e.currentTarget.classList.add("border-primary", "bg-surface-container-high")}
            onDragLeave={(e) => e.currentTarget.classList.remove("border-primary", "bg-surface-container-high")}
            onDrop={async (e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-primary", "bg-surface-container-high");
              const taskId = e.dataTransfer.getData("text/plain");
              if (taskId) {
                await handleUnscheduleTask(taskId);
              }
            }}
            className="bg-surface-container rounded-xl border border-outline-variant p-md mb-lg shadow-sm flex flex-col gap-sm transition-all duration-200"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm border-b border-outline-variant/30 pb-sm">
              <h3 className="font-h3 text-h3 text-on-surface font-semibold flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary text-[22px]">school</span>
                Courses & Task Backlog (Unscheduled)
              </h3>
              <form onSubmit={handleAddBacklog} className="flex gap-sm items-center">
                <input
                  type="text"
                  required
                  placeholder="Quick-add unscheduled task..."
                  className="bg-surface text-on-surface border border-outline-variant rounded px-sm py-xs font-body-sm text-body-sm focus:border-primary focus:outline-none max-w-[200px]"
                  value={newBacklogTitle}
                  onChange={(e) => setNewBacklogTitle(e.target.value)}
                />
                <select
                  className="bg-surface text-on-surface border border-outline-variant rounded px-xs py-xs font-body-sm text-body-sm focus:border-primary focus:outline-none"
                  value={newBacklogCategory}
                  onChange={(e) => setNewBacklogCategory(e.target.value as Task["category"])}
                >
                  <option value="Native">Native</option>
                  <option value="Coursera">Coursera</option>
                  <option value="Project">Project</option>
                  <option value="Gmail">Gmail</option>
                </select>
                <button
                  type="submit"
                  className="bg-[#507DBC] text-white hover:bg-[#436ca3] font-label-sm text-label-sm px-sm py-xs rounded flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Draggable Unscheduled List */}
            <div className="flex flex-wrap gap-sm py-xs min-h-[60px] items-center">
              {unscheduledTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="bg-surface px-md py-xs rounded border border-outline-variant hover:border-primary transition-all duration-200 cursor-grab active:cursor-grabbing flex items-center gap-sm group relative max-w-[240px] shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                    drag_indicator
                  </span>
                  <div className="flex flex-col truncate flex-1">
                    <span className="font-label-md text-label-md text-on-surface truncate font-semibold">
                      {task.title}
                    </span>
                    <span className="font-body-sm text-[10px] text-on-surface-variant uppercase tracking-wider">
                      {task.category}
                    </span>
                  </div>
                  <button 
                    onClick={async () => await deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all p-0.5 rounded hover:bg-surface-container-high cursor-pointer ml-xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              ))}

              {unscheduledTasks.length === 0 && (
                <div className="text-on-surface-variant text-body-sm italic w-full text-center py-xs">
                  Inbox empty. Drag calendar tasks here to unschedule them, or type above to add.
                </div>
              )}
            </div>
          </div>
          
          {/* 2. Bottom Panel: Navigation Month Header */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md mb-lg">
            <div className="flex items-center gap-md">
              <h1 className="font-h2 text-h2 text-on-surface font-bold">{monthName}</h1>
              <div className="flex items-center gap-xs ml-sm">
                <button 
                  onClick={handlePrevMonth}
                  className="p-xs rounded-full hover:bg-surface-container-high border border-outline-variant text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button 
                  onClick={handleGoToToday}
                  className="font-label-md text-label-md px-sm py-xs rounded hover:bg-surface-container-high border border-outline-variant text-on-surface-variant transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button 
                  onClick={handleNextMonth}
                  className="p-xs rounded-full hover:bg-surface-container-high border border-outline-variant text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setIsAddEventOpen(true)}
              className="bg-[#507DBC] text-white hover:bg-[#436ca3] font-label-md text-label-md px-md py-sm rounded transition-colors flex items-center gap-xs cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> New Event
            </button>
          </header>

          {/* Calendar Table Grid */}
          <div className="flex-1 bg-outline-variant border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm min-h-[480px]">
            
            {/* Days of week header */}
            <div className="grid grid-cols-7 bg-surface-container border-b border-outline-variant">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="py-sm text-center font-label-sm text-label-sm text-on-surface-variant">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="flex-1 grid grid-cols-7 gap-px bg-outline-variant">
              {calendarCells.map((cell, idx) => {
                const dayTasks = getTasksForDate(cell.date);
                const isSelected = isSameDay(cell.date, selectedDate);
                const isTodayDate = isSameDay(cell.date, new Date());

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(cell.date)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={(e) => {
                      e.currentTarget.classList.add("bg-surface-container-high");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("bg-surface-container-high");
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("bg-surface-container-high");
                      const taskId = e.dataTransfer.getData("text/plain");
                      if (taskId) {
                        await handleMoveTaskToDate(taskId, cell.date);
                      }
                    }}
                    className={`p-xs sm:p-sm flex flex-col min-h-[95px] sm:min-h-[115px] hover:bg-surface-container-low transition-colors relative group cursor-pointer ${
                      cell.isCurrentMonth ? "bg-surface" : "bg-surface-container-lowest"
                    } ${
                      isSelected ? "bg-primary-container/10 border-[1.5px] border-primary z-10 scale-[1.01] shadow" : ""
                    }`}
                  >
                    {/* Day number */}
                    <span className={`font-body-sm text-body-sm absolute top-xs right-xs w-6 h-6 flex items-center justify-center rounded-full ${
                      isTodayDate ? "bg-primary text-on-primary font-semibold" : 
                      isSelected ? "text-primary font-semibold" :
                      cell.isCurrentMonth ? "text-on-surface" : "text-on-surface-variant"
                    }`}>
                      {cell.date.getDate()}
                    </span>

                    {/* Tiny Event pills (Draggable) */}
                    <div className="mt-xl flex flex-col gap-1 overflow-hidden max-h-[50px] sm:max-h-[70px]">
                      {dayTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation(); // Avoid selecting cell as click
                            e.dataTransfer.setData("text/plain", task.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className={`border rounded px-xs py-px truncate font-label-sm text-label-sm flex items-center gap-xs cursor-grab active:cursor-grabbing hover:border-primary transition-all ${
                            task.category === "Coursera" ? "bg-primary-container border-primary text-on-primary-container" :
                            task.category === "Gmail" ? "bg-tertiary-container/20 border-tertiary-container/50 text-tertiary-fixed" :
                            task.category === "Notion" ? "bg-surface-variant/40 border border-outline-variant/60 text-on-surface" :
                            "bg-secondary-container/30 border border-secondary-container text-secondary"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            task.category === "Coursera" ? "bg-primary-fixed" :
                            task.category === "Gmail" ? "bg-tertiary" :
                            task.category === "Notion" ? "bg-outline" : "bg-secondary"
                          }`}></span>
                          <span className="truncate">{task.title}</span>
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[10px] text-on-surface-variant pl-xs">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* Selected Day side panel */}
        <aside className="w-full lg:w-[360px] bg-surface-container border-t lg:border-t-0 lg:border-l border-outline-variant h-auto lg:h-full flex flex-col shrink-0 relative shadow-[-4px_0_24px_rgba(0,0,0,0.2)]">
          
          {/* Panel Header */}
          <div className="p-lg border-b border-outline-variant flex flex-col gap-xs">
            <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
              Selected Day
            </span>
            <h2 className="font-h2 text-h2 text-on-surface font-semibold">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </h2>
          </div>

          {/* Events/Tasks List */}
          <div className="flex-1 overflow-y-auto p-md flex flex-col gap-md">
            {selectedDayTasks.map((task) => (
              <div 
                key={task.id}
                className="bg-surface border border-outline-variant rounded-lg p-md flex flex-col gap-sm hover:border-primary-container transition-colors group relative"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-sm">
                    <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                      task.category === "Coursera" ? "bg-primary-container text-on-primary-container" :
                      task.category === "Gmail" ? "bg-error-container/20 border border-error-container text-error" :
                      task.category === "Notion" ? "bg-surface-variant/30 border border-outline-variant text-on-surface-variant" :
                      "bg-secondary-container/20 border border-secondary text-secondary"
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {task.category === "Coursera" ? "videocam" : 
                         task.category === "Gmail" ? "mail" : 
                         task.category === "Notion" ? "description" : "assignment"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <h4 className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors font-semibold">
                        {task.title}
                      </h4>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {task.dueDate ? task.dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "No time"}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={async () => await deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all p-1 rounded hover:bg-surface-container-high cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
                {task.description && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant pl-10">
                    {task.description}
                  </p>
                )}
              </div>
            ))}
            
            {selectedDayTasks.length === 0 && (
              <div className="text-center py-xl text-on-surface-variant font-body-sm">
                No events or tasks scheduled for this day.
              </div>
            )}

            {/* Quick Inline Event Trigger */}
            <button 
              onClick={() => setIsAddEventOpen(true)}
              className="mt-sm border border-dashed border-outline-variant rounded-lg p-md flex items-center justify-center gap-sm text-on-surface-variant hover:text-primary hover:border-primary hover:bg-primary-container/5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span className="font-label-md text-label-md">
                Add event to {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </button>
          </div>
        </aside>

        {/* Add Event Modal */}
        {isAddEventOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-md">
            <div className="bg-surface-container rounded-xl border border-outline-variant w-full max-w-md p-lg relative shadow-xl">
              <button 
                onClick={() => setIsAddEventOpen(false)}
                className="absolute top-sm right-sm text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              
              <h3 className="font-h2 text-h2 text-on-surface mb-md pb-xs border-b border-outline-variant font-semibold">
                Add Event for {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </h3>
              
              <form onSubmit={handleAddEvent} className="flex flex-col gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant">Title</label>
                  <input 
                    type="text"
                    required
                    placeholder="Event title (e.g. CS101 Lecture)..."
                    className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant">Description / Join Link</label>
                  <textarea 
                    placeholder="Room zoom url, module assessment items..."
                    className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none h-20 resize-none"
                    value={newEventDesc}
                    onChange={(e) => setNewEventDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-md">
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Category</label>
                    <select 
                      className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none"
                      value={newEventCategory}
                      onChange={(e) => setNewEventCategory(e.target.value as Task["category"])}
                    >
                      <option value="Native">Native</option>
                      <option value="Coursera">Coursera</option>
                      <option value="Project">Project</option>
                      <option value="Gmail">Gmail</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant">Time</label>
                    <input 
                      type="time"
                      required
                      className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="bg-[#507DBC] text-white hover:bg-[#436ca3] font-label-md text-label-md py-md rounded-lg mt-sm transition-all cursor-pointer font-semibold"
                >
                  Save Event
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </Navigation>
  );
}
