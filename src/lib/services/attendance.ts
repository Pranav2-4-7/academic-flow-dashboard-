import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where 
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
