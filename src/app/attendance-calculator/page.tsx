"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Navigation } from "@/components/Navigation";
import { 
  getSubjectAttendance, 
  addSubject, 
  updateSubjectAttendance, 
  deleteSubject,
  getAttendanceLogsForDates,
  logAttendance,
  deleteAttendanceLog,
  getTimetable,
  SubjectAttendance,
  AttendanceLog,
  TimetableSlot
} from "@/lib/services/attendance";

export default function AttendanceCalculator() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // State
  const [subjects, setSubjects] = useState<SubjectAttendance[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  
  // Modals & Forms State
  const [newSubjectName, setNewSubjectName] = useState("");
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [logFormOpenForDate, setLogFormOpenForDate] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"present" | "absent">("present");

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Calculate dates for the selected week (Monday -> Sunday)
  const weekDays = useMemo(() => {
    const list = [];
    const date = new Date(currentWeekDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday is start of week
    const monday = new Date(date.setDate(diff));

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "long" }); // "Monday"
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }); // "Mon, Aug 24"
      const dayInitial = d.toLocaleDateString("en-US", { weekday: "narrow" }); // "M"
      list.push({ dateStr, dayName, dayLabel, dayInitial, rawDate: d });
    }
    return list;
  }, [currentWeekDate]);

  // Fetch Subject Attendance and Logs
  const fetchData = useCallback(async () => {
    if (!user) return;
    
    // 1. Fetch Subjects
    const fetchedSubjects = await getSubjectAttendance(user.uid);
    setSubjects(fetchedSubjects);

    // 2. Fetch Logs for this week's dates
    const dates = weekDays.map((d) => d.dateStr);
    const fetchedLogs = await getAttendanceLogsForDates(user.uid, dates);
    setLogs(fetchedLogs);

    // 3. Fetch Timetable slots
    const fetchedTimetable = await getTimetable(user.uid);
    setTimetable(fetchedTimetable);
  }, [user, weekDays]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, fetchData]);

  // Week navigation
  const handlePrevWeek = () => {
    const d = new Date(currentWeekDate);
    d.setDate(d.getDate() - 7);
    setCurrentWeekDate(d);
    setLogFormOpenForDate(null);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekDate);
    d.setDate(d.getDate() + 7);
    setCurrentWeekDate(d);
    setLogFormOpenForDate(null);
  };

  const handleGoToCurrentWeek = () => {
    setCurrentWeekDate(new Date());
    setLogFormOpenForDate(null);
  };

  // Handlers for Subjects
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSubjectName.trim()) return;

    try {
      await addSubject(user.uid, newSubjectName.trim());
      setNewSubjectName("");
      setShowAddSubject(false);
      fetchData();
    } catch (error) {
      console.error("Failed to add subject:", error);
    }
  };

  const handleUpdateSubjectCount = async (subId: string, presentChange: number, absentChange: number) => {
    if (!user) return;
    const sub = subjects.find((s) => s.id === subId);
    if (!sub) return;

    const newPresent = Math.max(0, sub.present + presentChange);
    const newAbsent = Math.max(0, sub.absent + absentChange);

    // Optimistic update
    setSubjects((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, present: newPresent, absent: newAbsent } : s))
    );

    try {
      await updateSubjectAttendance(user.uid, subId, newPresent, newAbsent);
      fetchData(); // Reload to sync logs and totals
    } catch (error) {
      console.error("Failed to update subject counts:", error);
      fetchData();
    }
  };

  const handleDeleteSubject = async (subId: string) => {
    if (!user) return;
    if (!confirm("Deleting this subject will not delete its history logs, but the subject summary will be removed. Are you sure?")) return;
    try {
      await deleteSubject(user.uid, subId);
      fetchData();
    } catch (error) {
      console.error("Failed to delete subject:", error);
    }
  };

  // Handlers for Logs
  const handleLogAttendance = async (e: React.FormEvent, dateStr: string) => {
    e.preventDefault();
    if (!user || !selectedSubjectId) return;

    const sub = subjects.find((s) => s.id === selectedSubjectId);
    if (!sub) return;

    try {
      await logAttendance(user.uid, selectedSubjectId, sub.name, dateStr, selectedStatus);
      setLogFormOpenForDate(null);
      setSelectedSubjectId("");
      fetchData();
    } catch (error) {
      console.error("Failed to log attendance:", error);
    }
  };

  const handleDeleteLog = async (logId: string, subjectId: string, status: "present" | "absent") => {
    if (!user) return;
    try {
      await deleteAttendanceLog(user.uid, logId, subjectId, status);
      fetchData();
    } catch (error) {
      console.error("Failed to delete attendance log:", error);
    }
  };

  // Toggle status for a specific timetable class slot
  const handleToggleSlotStatus = async (
    dayStr: string,
    subjectName: string,
    statusToSet: "present" | "absent"
  ) => {
    if (!user) return;

    const existingLog = logs.find(
      (l) => l.date === dayStr && l.subjectName.toLowerCase() === subjectName.toLowerCase()
    );

    // Try to find matching subject by name (case-insensitive)
    let sub = subjects.find((s) => s.name.toLowerCase() === subjectName.toLowerCase());
    
    try {
      // If subject doesn't exist, auto-create it!
      if (!sub) {
        sub = await addSubject(user.uid, subjectName);
      }

      if (existingLog) {
        if (existingLog.status === statusToSet) {
          // If clicked active status -> delete log
          await deleteAttendanceLog(user.uid, existingLog.id, existingLog.subjectId, existingLog.status);
        } else {
          // If clicked different status -> replace log
          await deleteAttendanceLog(user.uid, existingLog.id, existingLog.subjectId, existingLog.status);
          await logAttendance(user.uid, sub.id, sub.name, dayStr, statusToSet);
        }
      } else {
        // Create new log
        await logAttendance(user.uid, sub.id, sub.name, dayStr, statusToSet);
      }
      fetchData();
    } catch (error) {
      console.error("Failed to toggle slot status:", error);
    }
  };

  // Calculate overall weekly summary info
  const weekLabelRange = useMemo(() => {
    if (weekDays.length === 0) return "";
    const first = weekDays[0].rawDate;
    const last = weekDays[6].rawDate;
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${first.toLocaleDateString("en-US", options)} - ${last.toLocaleDateString("en-US", options)}, ${last.getFullYear()}`;
  }, [weekDays]);

  return (
    <Navigation activeTab="attendance">
      <div className="flex h-screen w-full flex-col lg:flex-row overflow-hidden">
        
        {/* Main Section: Weekly Logs Columns */}
        <div className="flex-1 flex flex-col p-lg lg:p-xl h-full overflow-y-auto">
          
          {/* Top Panel: Header & Week Navigation */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md mb-lg">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                Daily Tracker
              </span>
              <h1 className="font-h2 text-h2 text-on-surface font-bold">Attendance Logs</h1>
            </div>
            
            <div className="flex items-center gap-xs">
              <button 
                onClick={handlePrevWeek}
                className="p-xs rounded-full hover:bg-surface-container-high border border-outline-variant text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              
              <button 
                onClick={handleGoToCurrentWeek}
                className="font-label-md text-label-md px-sm py-xs rounded hover:bg-surface-container-high border border-outline-variant text-on-surface-variant transition-colors cursor-pointer"
              >
                This Week
              </button>
              
              <span className="font-body-md text-body-md text-on-surface px-sm py-xs font-semibold">
                {weekLabelRange}
              </span>
              
              <button 
                onClick={handleNextWeek}
                className="p-xs rounded-full hover:bg-surface-container-high border border-outline-variant text-on-surface-variant transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </header>

          {/* Timetable/Logs Grid: 7 columns (Mon -> Sun) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-md bg-outline-variant/10 rounded-xl p-md border border-outline-variant shadow-inner min-h-[450px]">
            {weekDays.map((day) => {
              const dayLogs = logs.filter((l) => l.date === day.dateStr);
              const daySlots = timetable.filter((s) => s.day.toLowerCase() === day.dayName.toLowerCase());
              const extraLogs = dayLogs.filter(
                (log) => !daySlots.some((s) => s.subjectName.toLowerCase() === log.subjectName.toLowerCase())
              );
              const isToday = new Date().toISOString().split("T")[0] === day.dateStr;

              return (
                <div 
                  key={day.dateStr}
                  className={`flex flex-col bg-surface rounded-xl border p-md min-h-[300px] shadow-sm relative ${
                    isToday ? "border-primary border-[2px] shadow bg-primary-container/5" : "border-outline-variant"
                  }`}
                >
                  {/* Day Date Label */}
                  <div className="flex flex-col items-center justify-center border-b border-outline-variant/40 pb-sm mb-sm text-center">
                    <span className={`font-label-sm text-[10px] tracking-widest uppercase font-bold ${
                      isToday ? "text-primary" : "text-on-surface-variant"
                    }`}>
                      {day.dayName}
                    </span>
                    <span className={`font-body-md text-body-md font-semibold ${
                      isToday ? "text-primary font-bold" : "text-on-surface"
                    }`}>
                      {day.dayLabel}
                    </span>
                  </div>

                  {/* Scheduled Classes & Custom Logs */}
                  <div className="flex-1 flex flex-col gap-sm overflow-y-auto mb-sm pr-xs">
                    {/* 1. Timetable Slots */}
                    {daySlots.map((slot) => {
                      const log = dayLogs.find((l) => l.subjectName.toLowerCase() === slot.subjectName.toLowerCase());
                      const isPresent = log?.status === "present";
                      const isAbsent = log?.status === "absent";

                      return (
                        <div 
                          key={slot.id}
                          className="bg-surface-container-low border border-outline-variant/50 rounded-lg p-xs flex flex-col gap-xs text-[11px] relative"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-on-surface truncate pr-xs" title={slot.subjectName}>
                              {slot.subjectName}
                            </span>
                            <span className="text-[9px] text-on-surface-variant bg-surface-container px-1 py-0.2 rounded font-medium capitalize">
                              {slot.type}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center text-[10px] text-on-surface-variant">
                            <span>{slot.time}</span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => handleToggleSlotStatus(day.dateStr, slot.subjectName, "present")}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-all ${
                                  isPresent
                                    ? "bg-secondary text-white border-secondary font-bold"
                                    : "bg-surface text-on-surface-variant border-outline-variant/60 hover:border-secondary hover:text-secondary"
                                }`}
                              >
                                P
                              </button>
                              <button
                                onClick={() => handleToggleSlotStatus(day.dateStr, slot.subjectName, "absent")}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-all ${
                                  isAbsent
                                    ? "bg-error text-white border-error font-bold"
                                    : "bg-surface text-on-surface-variant border-outline-variant/60 hover:border-error hover:text-error"
                                }`}
                              >
                                A
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* 2. Custom Extra Logs */}
                    {extraLogs.length > 0 && (
                      <div className="border-t border-outline-variant/40 pt-sm mt-xs flex flex-col gap-sm">
                        <span className="text-[9px] uppercase tracking-wider text-on-surface-variant font-bold">Extra Logs</span>
                        {extraLogs.map((log) => (
                          <div 
                            key={log.id}
                            className={`flex flex-col p-xs rounded border text-body-sm relative group ${
                              log.status === "present"
                                ? "bg-secondary-container/20 border-secondary text-secondary"
                                : "bg-error-container/10 border-error text-error"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-semibold truncate max-w-[70px] pr-xs" title={log.subjectName}>
                                {log.subjectName}
                              </span>
                              <button
                                onClick={() => handleDeleteLog(log.id, log.subjectId, log.status)}
                                className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-colors shrink-0 p-0.5 rounded cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                              </button>
                            </div>
                            <span className={`text-[9px] uppercase font-bold tracking-wide ${
                              log.status === "present" ? "text-secondary" : "text-error"
                            }`}>
                              {log.status === "present" ? "Present" : "Absent"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {daySlots.length === 0 && extraLogs.length === 0 && (
                      <div className="text-[10px] text-on-surface-variant/60 italic text-center my-auto py-md">
                        No classes scheduled
                      </div>
                    )}
                  </div>

                  {/* Add Log Inline Form / Button */}
                  <div className="mt-auto">
                    {logFormOpenForDate === day.dateStr ? (
                      <form 
                        onSubmit={(e) => handleLogAttendance(e, day.dateStr)}
                        className="bg-surface-container border border-outline-variant rounded p-sm flex flex-col gap-xs z-10 relative"
                      >
                        <select
                          required
                          className="bg-surface text-on-surface border border-outline-variant rounded p-xs text-xs focus:border-primary focus:outline-none cursor-pointer"
                          value={selectedSubjectId}
                          onChange={(e) => setSelectedSubjectId(e.target.value)}
                        >
                          <option value="">Select subject...</option>
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                        </select>

                        <div className="grid grid-cols-2 gap-xs text-[10px]">
                          <label className="flex items-center gap-xs cursor-pointer select-none">
                            <input
                              type="radio"
                              name="status"
                              checked={selectedStatus === "present"}
                              onChange={() => setSelectedStatus("present")}
                            />
                            Present
                          </label>
                          <label className="flex items-center gap-xs cursor-pointer select-none">
                            <input
                              type="radio"
                              name="status"
                              checked={selectedStatus === "absent"}
                              onChange={() => setSelectedStatus("absent")}
                            />
                            Absent
                          </label>
                        </div>

                        <div className="flex justify-between gap-xs mt-xs text-[10px]">
                          <button
                            type="button"
                            onClick={() => setLogFormOpenForDate(null)}
                            className="flex-1 bg-surface-container-high hover:bg-surface-bright border border-outline-variant p-0.5 rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 bg-[#507DBC] hover:bg-[#436ca3] text-white p-0.5 rounded cursor-pointer"
                          >
                            Log
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setLogFormOpenForDate(day.dateStr);
                          setSelectedStatus("present");
                          if (subjects.length > 0 && !selectedSubjectId) {
                            setSelectedSubjectId(subjects[0].id);
                          }
                        }}
                        className="w-full border border-dashed border-outline-variant/65 rounded-lg py-1.5 flex items-center justify-center gap-xs text-on-surface-variant hover:text-primary hover:border-primary hover:bg-primary-container/5 transition-all text-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">add_circle</span>
                        <span>Log Attendance</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: Subject Summary & Calculations */}
        <aside className="w-full lg:w-[360px] bg-surface-container border-t lg:border-t-0 lg:border-l border-outline-variant h-auto lg:h-full flex flex-col shrink-0 relative shadow-[-4px_0_24px_rgba(0,0,0,0.15)]">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                Summary
              </span>
              <h2 className="font-h2 text-h2 text-on-surface font-bold">
                Subject Percentages
              </h2>
            </div>
            
            <button 
              onClick={() => setShowAddSubject(!showAddSubject)}
              className="bg-primary text-on-primary hover:bg-primary/90 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-xs cursor-pointer active:scale-95 transition-all font-semibold"
            >
              <span className="material-symbols-outlined text-[14px]">add</span> Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-md flex flex-col gap-md">
            {showAddSubject && (
              <form 
                onSubmit={handleAddSubject} 
                className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-sm shadow-sm"
              >
                <div className="flex flex-col gap-xs">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CM, Operating Systems..."
                    className="bg-surface text-on-surface border border-outline-variant rounded p-sm text-body-sm focus:border-primary focus:outline-none"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                  />
                </div>
                <div className="flex gap-sm justify-end text-xs">
                  <button
                    type="button"
                    onClick={() => setShowAddSubject(false)}
                    className="bg-surface-container-high border border-outline-variant px-sm py-1.5 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#507DBC] text-white hover:bg-[#436ca3] px-md py-1.5 rounded-lg cursor-pointer font-semibold"
                  >
                    Save Subject
                  </button>
                </div>
              </form>
            )}

            {/* List of Subjects */}
            {subjects.map((sub) => {
              const total = sub.present + sub.absent;
              const percentage = total > 0 ? Math.round((sub.present / total) * 100) : 0;
              return (
                <div 
                  key={sub.id}
                  className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-sm hover:border-primary-container transition-colors group relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col max-w-[220px]">
                      <h4 className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors font-bold truncate">
                        {sub.name}
                      </h4>
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        Total classes: {total}
                      </span>
                    </div>

                    <div className="flex items-center gap-xs">
                      <span className={`font-label-md text-label-md font-bold px-2 py-0.5 rounded ${
                        percentage >= 75 ? "bg-secondary-container/20 text-secondary" : "bg-error-container/10 text-error"
                      }`}>
                        {percentage}%
                      </span>
                      <button 
                        onClick={() => handleDeleteSubject(sub.id)}
                        className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all p-1 rounded hover:bg-surface-container-high cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    {/* Manual Override controls for Present */}
                    <div className="flex items-center gap-xs bg-surface-container p-1 rounded border border-outline-variant/40">
                      <span className="font-semibold text-[10px] pl-xs">P: {sub.present}</span>
                      <div className="flex gap-0.5 ml-xs border-l border-outline-variant/40 pl-xs">
                        <button 
                          onClick={() => handleUpdateSubjectCount(sub.id, 1, 0)}
                          className="w-4 h-4 bg-surface-container-high hover:bg-surface-bright rounded text-[9px] flex items-center justify-center font-bold cursor-pointer"
                        >+</button>
                        <button 
                          onClick={() => handleUpdateSubjectCount(sub.id, -1, 0)}
                          className="w-4 h-4 bg-surface-container-high hover:bg-surface-bright rounded text-[9px] flex items-center justify-center font-bold cursor-pointer"
                        >-</button>
                      </div>
                    </div>

                    {/* Manual Override controls for Absent */}
                    <div className="flex items-center gap-xs bg-surface-container p-1 rounded border border-outline-variant/40">
                      <span className="font-semibold text-[10px] pl-xs">A: {sub.absent}</span>
                      <div className="flex gap-0.5 ml-xs border-l border-outline-variant/40 pl-xs">
                        <button 
                          onClick={() => handleUpdateSubjectCount(sub.id, 0, 1)}
                          className="w-4 h-4 bg-surface-container-high hover:bg-surface-bright rounded text-[9px] flex items-center justify-center font-bold cursor-pointer"
                        >+</button>
                        <button 
                          onClick={() => handleUpdateSubjectCount(sub.id, 0, -1)}
                          className="w-4 h-4 bg-surface-container-high hover:bg-surface-bright rounded text-[9px] flex items-center justify-center font-bold cursor-pointer"
                        >-</button>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Percentage Progress Bar */}
                  <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden mt-xs">
                    <div 
                      className={`h-full transition-all duration-300 ${percentage >= 75 ? "bg-secondary" : "bg-error"}`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}

            {subjects.length === 0 && (
              <div className="text-center py-xl text-on-surface-variant font-body-sm">
                No subjects. Add one to start logging attendance!
              </div>
            )}
          </div>
        </aside>

      </div>
    </Navigation>
  );
}
