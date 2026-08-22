import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  query, 
  where,
  addDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AttendanceRecord {
  id: string; // userId_date
  userId: string;
  date: string; // YYYY-MM-DD
  status: "present" | "absent" | "excused" | "none";
}

const getGuestAttendanceFromStorage = (): Record<string, AttendanceRecord["status"]> => {
  if (typeof window === "undefined") return {};
  const data = localStorage.getItem("study_sync_guest_attendance");
  if (!data) {
    // Populate some default attendance values for the last few days
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    
    const d1 = new Date(today); d1.setDate(today.getDate() - 1);
    const d2 = new Date(today); d2.setDate(today.getDate() - 2);
    const d3 = new Date(today); d3.setDate(today.getDate() - 3);
    const d4 = new Date(today); d4.setDate(today.getDate() - 4);

    const defaultAttendance: Record<string, AttendanceRecord["status"]> = {
      [formatDate(d1)]: "present",
      [formatDate(d2)]: "present",
      [formatDate(d3)]: "absent",
      [formatDate(d4)]: "present",
    };
    localStorage.setItem("study_sync_guest_attendance", JSON.stringify(defaultAttendance));
    return defaultAttendance;
  }
  return JSON.parse(data);
};

export const setAttendance = async (
  userId: string, 
  date: string, 
  status: AttendanceRecord["status"]
) => {
  if (userId === "guest_user") {
    const attendance = getGuestAttendanceFromStorage();
    attendance[date] = status;
    localStorage.setItem("study_sync_guest_attendance", JSON.stringify(attendance));
    
    // Dispatch a storage event to synchronize open components
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    return;
  }

  const docId = `${userId}_${date}`;
  const docRef = doc(db, "attendance", docId);
  
  if (status === "none") {
    await setDoc(docRef, {
      userId,
      date,
      status: "none",
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } else {
    await setDoc(docRef, {
      userId,
      date,
      status,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
};

export const getAttendanceForDates = async (
  userId: string, 
  dates: string[]
): Promise<Record<string, AttendanceRecord["status"]>> => {
  const records: Record<string, AttendanceRecord["status"]> = {};
  
  if (dates.length === 0) return records;

  if (userId === "guest_user") {
    const attendance = getGuestAttendanceFromStorage();
    dates.forEach((d) => {
      records[d] = attendance[d] || "none";
    });
    return records;
  }
  
  const q = query(
    collection(db, "attendance"),
    where("userId", "==", userId),
    where("date", "in", dates)
  );
  
  try {
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      records[data.date] = data.status || "none";
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
  }
  
  return records;
};

export interface SubjectAttendance {
  id: string;
  userId: string;
  name: string;
  present: number;
  absent: number;
  updatedAt: string;
}

// Local storage helpers for Guest Mode
const getGuestSubjectsFromStorage = (): SubjectAttendance[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("study_sync_guest_subjects");
  if (!data) {
    const today = new Date().toISOString();
    const defaultSubjects: SubjectAttendance[] = [
      { id: "sub_1", userId: "guest_user", name: "CM", present: 0, absent: 0, updatedAt: today },
      { id: "sub_2", userId: "guest_user", name: "CM Lab", present: 0, absent: 0, updatedAt: today },
      { id: "sub_3", userId: "guest_user", name: "OOPs", present: 0, absent: 0, updatedAt: today },
      { id: "sub_4", userId: "guest_user", name: "OOPs Lab", present: 0, absent: 0, updatedAt: today },
      { id: "sub_5", userId: "guest_user", name: "DLCD", present: 0, absent: 0, updatedAt: today },
      { id: "sub_6", userId: "guest_user", name: "DLCD Lab", present: 0, absent: 0, updatedAt: today },
      { id: "sub_7", userId: "guest_user", name: "DS", present: 0, absent: 0, updatedAt: today },
      { id: "sub_8", userId: "guest_user", name: "DS Lab", present: 0, absent: 0, updatedAt: today },
      { id: "sub_9", userId: "guest_user", name: "DM", present: 0, absent: 0, updatedAt: today },
    ];
    localStorage.setItem("study_sync_guest_subjects", JSON.stringify(defaultSubjects));
    return defaultSubjects;
  }
  return JSON.parse(data);
};

export const getSubjectAttendance = async (userId: string): Promise<SubjectAttendance[]> => {
  if (userId === "guest_user") {
    return getGuestSubjectsFromStorage();
  }

  const q = query(
    collection(db, "subjects"),
    where("userId", "==", userId)
  );

  try {
    const querySnapshot = await getDocs(q);
    const subjects: SubjectAttendance[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      subjects.push({
        id: doc.id,
        userId: data.userId,
        name: data.name || "",
        present: typeof data.present === "number" ? data.present : 0,
        absent: typeof data.absent === "number" ? data.absent : 0,
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });
    return subjects.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error getting subject attendance:", error);
    return [];
  }
};

export const addSubject = async (userId: string, name: string): Promise<SubjectAttendance> => {
  const today = new Date().toISOString();
  if (userId === "guest_user") {
    const subjects = getGuestSubjectsFromStorage();
    const newSubject: SubjectAttendance = {
      id: "sub_" + Date.now(),
      userId,
      name,
      present: 0,
      absent: 0,
      updatedAt: today,
    };
    subjects.push(newSubject);
    localStorage.setItem("study_sync_guest_subjects", JSON.stringify(subjects));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    return newSubject;
  }

  try {
    const colRef = collection(db, "subjects");
    const docRef = await addDoc(colRef, {
      userId,
      name,
      present: 0,
      absent: 0,
      updatedAt: today,
    });
    return {
      id: docRef.id,
      userId,
      name,
      present: 0,
      absent: 0,
      updatedAt: today,
    };
  } catch (error) {
    console.error("Error adding subject:", error);
    throw error;
  }
};

export const updateSubjectAttendance = async (
  userId: string,
  subjectId: string,
  present: number,
  absent: number
): Promise<void> => {
  const today = new Date().toISOString();
  if (userId === "guest_user") {
    const subjects = getGuestSubjectsFromStorage();
    const updated = subjects.map((sub) =>
      sub.id === subjectId ? { ...sub, present, absent, updatedAt: today } : sub
    );
    localStorage.setItem("study_sync_guest_subjects", JSON.stringify(updated));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    return;
  }

  try {
    const docRef = doc(db, "subjects", subjectId);
    await updateDoc(docRef, {
      present,
      absent,
      updatedAt: today,
    });
  } catch (error) {
    console.error("Error updating subject attendance:", error);
    throw error;
  }
};

export const deleteSubject = async (userId: string, subjectId: string): Promise<void> => {
  if (userId === "guest_user") {
    const subjects = getGuestSubjectsFromStorage();
    const filtered = subjects.filter((sub) => sub.id !== subjectId);
    localStorage.setItem("study_sync_guest_subjects", JSON.stringify(filtered));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    return;
  }

  try {
    const docRef = doc(db, "subjects", subjectId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting subject:", error);
    throw error;
  }
};

export interface AttendanceLog {
  id: string;
  userId: string;
  subjectId: string;
  subjectName: string;
  date: string; // YYYY-MM-DD
  status: "present" | "absent";
  updatedAt: string;
}

const getGuestLogsFromStorage = (): AttendanceLog[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("study_sync_guest_logs");
  if (!data) {
    // Populate some default logs for this week
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    
    // Find this week's Monday
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    
    const dMon = new Date(monday);
    const dTue = new Date(monday); dTue.setDate(monday.getDate() + 1);
    const dWed = new Date(monday); dWed.setDate(monday.getDate() + 2);
    
    const defaultLogs: AttendanceLog[] = [
      { id: "log_1", userId: "guest_user", subjectId: "sub_1", subjectName: "Data Structures", date: formatDate(dMon), status: "present", updatedAt: new Date().toISOString() },
      { id: "log_2", userId: "guest_user", subjectId: "sub_2", subjectName: "Linear Algebra", date: formatDate(dMon), status: "present", updatedAt: new Date().toISOString() },
      { id: "log_3", userId: "guest_user", subjectId: "sub_3", subjectName: "Operating Systems", date: formatDate(dTue), status: "absent", updatedAt: new Date().toISOString() },
      { id: "log_4", userId: "guest_user", subjectId: "sub_1", subjectName: "Data Structures", date: formatDate(dWed), status: "present", updatedAt: new Date().toISOString() },
    ];
    localStorage.setItem("study_sync_guest_logs", JSON.stringify(defaultLogs));
    return defaultLogs;
  }
  return JSON.parse(data);
};

export const getAttendanceLogsForDates = async (
  userId: string,
  dates: string[]
): Promise<AttendanceLog[]> => {
  if (dates.length === 0) return [];

  if (userId === "guest_user") {
    const logs = getGuestLogsFromStorage();
    return logs.filter((l) => dates.includes(l.date));
  }

  const q = query(
    collection(db, "attendance_logs"),
    where("userId", "==", userId),
    where("date", "in", dates)
  );

  try {
    const querySnapshot = await getDocs(q);
    const logs: AttendanceLog[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        userId: data.userId,
        subjectId: data.subjectId,
        subjectName: data.subjectName || "",
        date: data.date,
        status: data.status,
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });
    return logs;
  } catch (error) {
    console.error("Error getting attendance logs:", error);
    return [];
  }
};

export const logAttendance = async (
  userId: string,
  subjectId: string,
  subjectName: string,
  date: string,
  status: "present" | "absent"
): Promise<AttendanceLog> => {
  const today = new Date().toISOString();
  if (userId === "guest_user") {
    const logs = getGuestLogsFromStorage();
    const newLog: AttendanceLog = {
      id: "log_" + Date.now(),
      userId,
      subjectId,
      subjectName,
      date,
      status,
      updatedAt: today,
    };
    logs.push(newLog);
    localStorage.setItem("study_sync_guest_logs", JSON.stringify(logs));
    
    // Auto-update subject attendance counters in localStorage
    const subjects = JSON.parse(localStorage.getItem("study_sync_guest_subjects") || "[]") as SubjectAttendance[];
    const updatedSubjects = subjects.map((sub) => {
      if (sub.id === subjectId) {
        return {
          ...sub,
          present: status === "present" ? sub.present + 1 : sub.present,
          absent: status === "absent" ? sub.absent + 1 : sub.absent,
          updatedAt: today,
        };
      }
      return sub;
    });
    localStorage.setItem("study_sync_guest_subjects", JSON.stringify(updatedSubjects));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    return newLog;
  }

  try {
    // 1. Add log entry
    const colRef = collection(db, "attendance_logs");
    const docRef = await addDoc(colRef, {
      userId,
      subjectId,
      subjectName,
      date,
      status,
      updatedAt: today,
    });

    // 2. Read and update subject counters in Firestore
    const subRef = doc(db, "subjects", subjectId);
    const subjects = await getSubjectAttendance(userId);
    const sub = subjects.find(s => s.id === subjectId);
    if (sub) {
      const newPresent = status === "present" ? sub.present + 1 : sub.present;
      const newAbsent = status === "absent" ? sub.absent + 1 : sub.absent;
      await updateDoc(subRef, {
        present: newPresent,
        absent: newAbsent,
        updatedAt: today,
      });
    }

    return {
      id: docRef.id,
      userId,
      subjectId,
      subjectName,
      date,
      status,
      updatedAt: today,
    };
  } catch (error) {
    console.error("Error logging attendance:", error);
    throw error;
  }
};

export const deleteAttendanceLog = async (
  userId: string,
  logId: string,
  subjectId: string,
  status: "present" | "absent"
): Promise<void> => {
  const today = new Date().toISOString();
  if (userId === "guest_user") {
    const logs = getGuestLogsFromStorage();
    const filtered = logs.filter((l) => l.id !== logId);
    localStorage.setItem("study_sync_guest_logs", JSON.stringify(filtered));

    // Auto-update subject attendance counters (decrement) in localStorage
    const subjects = JSON.parse(localStorage.getItem("study_sync_guest_subjects") || "[]") as SubjectAttendance[];
    const updatedSubjects = subjects.map((sub) => {
      if (sub.id === subjectId) {
        return {
          ...sub,
          present: status === "present" ? Math.max(0, sub.present - 1) : sub.present,
          absent: status === "absent" ? Math.max(0, sub.absent - 1) : sub.absent,
          updatedAt: today,
        };
      }
      return sub;
    });
    localStorage.setItem("study_sync_guest_subjects", JSON.stringify(updatedSubjects));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    return;
  }

  try {
    // 1. Delete log entry
    const docRef = doc(db, "attendance_logs", logId);
    await deleteDoc(docRef);

    // 2. Decrement subject counters
    const subRef = doc(db, "subjects", subjectId);
    const subjects = await getSubjectAttendance(userId);
    const sub = subjects.find(s => s.id === subjectId);
    if (sub) {
      const newPresent = status === "present" ? Math.max(0, sub.present - 1) : sub.present;
      const newAbsent = status === "absent" ? Math.max(0, sub.absent - 1) : sub.absent;
      await updateDoc(subRef, {
        present: newPresent,
        absent: newAbsent,
        updatedAt: today,
      });
    }
  } catch (error) {
    console.error("Error deleting attendance log:", error);
    throw error;
  }
};

export interface TimetableSlot {
  id: string;
  userId: string;
  day: string; // "Monday", "Tuesday", etc.
  subjectName: string;
  time: string; // "10:00"
  type: "lecture" | "lab";
}

const getGuestTimetableFromStorage = (): TimetableSlot[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("study_sync_guest_timetable");
  if (!data) {
    const defaultTimetable: TimetableSlot[] = [
      // Monday
      { id: "slot_m1", userId: "guest_user", day: "Monday", subjectName: "CM", time: "09:00", type: "lecture" },
      { id: "slot_m2", userId: "guest_user", day: "Monday", subjectName: "DS Lab", time: "10:00", type: "lab" },
      { id: "slot_m3", userId: "guest_user", day: "Monday", subjectName: "DS Lab", time: "11:00", type: "lab" },
      { id: "slot_m4", userId: "guest_user", day: "Monday", subjectName: "OOPs", time: "12:30", type: "lecture" },
      { id: "slot_m5", userId: "guest_user", day: "Monday", subjectName: "DLCD", time: "13:30", type: "lecture" },

      // Tuesday
      { id: "slot_t1", userId: "guest_user", day: "Tuesday", subjectName: "DM", time: "09:00", type: "lecture" },
      { id: "slot_t2", userId: "guest_user", day: "Tuesday", subjectName: "OOPs Lab", time: "10:00", type: "lab" },
      { id: "slot_t3", userId: "guest_user", day: "Tuesday", subjectName: "OOPs Lab", time: "11:00", type: "lab" },
      { id: "slot_t4", userId: "guest_user", day: "Tuesday", subjectName: "CM", time: "12:30", type: "lecture" },
      { id: "slot_t5", userId: "guest_user", day: "Tuesday", subjectName: "DS", time: "13:30", type: "lecture" },
      { id: "slot_t6", userId: "guest_user", day: "Tuesday", subjectName: "DLCD", time: "14:30", type: "lecture" },

      // Wednesday
      { id: "slot_w1", userId: "guest_user", day: "Wednesday", subjectName: "DLCD Lab", time: "10:00", type: "lab" },
      { id: "slot_w2", userId: "guest_user", day: "Wednesday", subjectName: "DLCD Lab", time: "11:00", type: "lab" },
      { id: "slot_w3", userId: "guest_user", day: "Wednesday", subjectName: "DM", time: "12:30", type: "lecture" },
      { id: "slot_w4", userId: "guest_user", day: "Wednesday", subjectName: "DS", time: "13:30", type: "lecture" },

      // Thursday
      { id: "slot_th1", userId: "guest_user", day: "Thursday", subjectName: "CM Lab", time: "08:00", type: "lab" },
      { id: "slot_th2", userId: "guest_user", day: "Thursday", subjectName: "CM Lab", time: "09:00", type: "lab" },
      { id: "slot_th3", userId: "guest_user", day: "Thursday", subjectName: "CM", time: "10:00", type: "lecture" },
      { id: "slot_th4", userId: "guest_user", day: "Thursday", subjectName: "OOPs", time: "11:00", type: "lecture" },
      { id: "slot_th5", userId: "guest_user", day: "Thursday", subjectName: "DS", time: "12:30", type: "lecture" },
      { id: "slot_th6", userId: "guest_user", day: "Thursday", subjectName: "DM", time: "13:30", type: "lecture" },
      { id: "slot_th7", userId: "guest_user", day: "Thursday", subjectName: "DLCD", time: "14:30", type: "lecture" },

      // Friday
      { id: "slot_f1", userId: "guest_user", day: "Friday", subjectName: "DM", time: "09:00", type: "lecture" },
      { id: "slot_f2", userId: "guest_user", day: "Friday", subjectName: "CM", time: "10:00", type: "lecture" },
      { id: "slot_f3", userId: "guest_user", day: "Friday", subjectName: "DLCD", time: "11:00", type: "lecture" },
      { id: "slot_f4", userId: "guest_user", day: "Friday", subjectName: "OOPs", time: "12:30", type: "lecture" },
      { id: "slot_f5", userId: "guest_user", day: "Friday", subjectName: "DS", time: "13:30", type: "lecture" },
    ];
    localStorage.setItem("study_sync_guest_timetable", JSON.stringify(defaultTimetable));
    return defaultTimetable;
  }
  return JSON.parse(data);
};

export const getTimetable = async (userId: string): Promise<TimetableSlot[]> => {
  if (userId === "guest_user") {
    return getGuestTimetableFromStorage();
  }

  const q = query(
    collection(db, "timetable"),
    where("userId", "==", userId)
  );

  try {
    const querySnapshot = await getDocs(q);
    const slots: TimetableSlot[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      slots.push({
        id: doc.id,
        userId: data.userId,
        day: data.day,
        subjectName: data.subjectName,
        time: data.time || "",
        type: data.type || "lecture",
      });
    });
    return slots.sort((a, b) => a.time.localeCompare(b.time));
  } catch (error) {
    console.error("Error getting timetable:", error);
    return [];
  }
};

export const saveTimetable = async (
  userId: string,
  slots: Omit<TimetableSlot, "id" | "userId">[]
): Promise<void> => {
  if (userId === "guest_user") {
    const formatted = slots.map((s, idx) => ({
      ...s,
      id: "slot_" + idx + "_" + Date.now(),
      userId,
    }));
    localStorage.setItem("study_sync_guest_timetable", JSON.stringify(formatted));
    return;
  }

  try {
    // 1. Delete all existing timetable slots for the user
    const q = query(
      collection(db, "timetable"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map((d) => deleteDoc(doc(db, "timetable", d.id)));
    await Promise.all(deletePromises);

    // 2. Add the new slots
    const addPromises = slots.map((s) =>
      addDoc(collection(db, "timetable"), {
        ...s,
        userId,
      })
    );
    await Promise.all(addPromises);
  } catch (error) {
    console.error("Error saving timetable:", error);
    throw error;
  }
};
