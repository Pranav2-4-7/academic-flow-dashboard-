import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  dueDate: Date | null;
  category: "Coursera" | "Native" | "Project" | "Gmail" | "Notion";
  status: "todo" | "in_progress" | "done";
  source: "coursera" | "native" | "gmail" | "notion";
  createdAt: Date;
}

const docToTask = (id: string, data: any): Task => {
  return {
    id,
    userId: data.userId,
    title: data.title || "",
    description: data.description || "",
    dueDate: data.dueDate ? (data.dueDate instanceof Timestamp ? data.dueDate.toDate() : new Date(data.dueDate)) : null,
    category: data.category || "Native",
    status: data.status || "todo",
    source: data.source || "native",
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
  };
};

// In-memory registry for local Guest subscribers
let guestSubscribers: Array<(tasks: Task[]) => void> = [];

const notifyGuestSubscribers = () => {
  const tasks = getGuestTasksFromStorage();
  guestSubscribers.forEach((cb) => cb(tasks));
};

const getGuestTasksFromStorage = (): Task[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("study_sync_guest_tasks");
  if (!data) {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const inThreeDays = new Date();
    inThreeDays.setDate(today.getDate() + 3);

    const defaultTasks: Task[] = [
      {
        id: "guest_task_1",
        userId: "guest_user",
        title: "Data Structures Quiz",
        description: "Focus on Red-Black Trees and Graph traversals",
        dueDate: today,
        category: "Coursera",
        status: "todo",
        source: "coursera",
        createdAt: today,
      },
      {
        id: "guest_task_2",
        userId: "guest_user",
        title: "Midterm Prep",
        description: "Study lecture notes 1 through 6",
        dueDate: tomorrow,
        category: "Native",
        status: "todo",
        source: "native",
        createdAt: today,
      },
      {
        id: "guest_task_3",
        userId: "guest_user",
        title: "UI Design System",
        description: "Establish HSL color styles and component layouts",
        dueDate: inThreeDays,
        category: "Project",
        status: "in_progress",
        source: "native",
        createdAt: today,
      },
      {
        id: "guest_task_4",
        userId: "guest_user",
        title: "Read Chapter 4 (Calculus)",
        description: "Study limits and continuity limits definition. Unscheduled task backlog card.",
        dueDate: null, // Unscheduled!
        category: "Native",
        status: "todo",
        source: "native",
        createdAt: today,
      }
    ];
    localStorage.setItem("study_sync_guest_tasks", JSON.stringify(defaultTasks));
    return defaultTasks;
  }
  return JSON.parse(data).map((t: any) => ({
    ...t,
    dueDate: t.dueDate ? new Date(t.dueDate) : null,
    createdAt: new Date(t.createdAt),
  }));
};

export const subscribeToTasks = (userId: string, callback: (tasks: Task[]) => void) => {
  if (userId === "guest_user") {
    guestSubscribers.push(callback);
    callback(getGuestTasksFromStorage());
    return () => {
      guestSubscribers = guestSubscribers.filter((cb) => cb !== callback);
    };
  }

  const q = query(
    collection(db, "tasks"),
    where("userId", "==", userId),
    orderBy("dueDate", "asc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks = snapshot.docs.map((doc) => docToTask(doc.id, doc.data()));
      callback(tasks);
    },
    (error) => {
      console.error("Error subscribing to tasks:", error);
    }
  );
};

export const addTask = async (task: Omit<Task, "id" | "createdAt">) => {
  if (task.userId === "guest_user") {
    const tasks = getGuestTasksFromStorage();
    const newTaskId = "guest_task_" + Date.now();
    const newTask: Task = {
      ...task,
      id: newTaskId,
      createdAt: new Date(),
    };
    tasks.push(newTask);
    localStorage.setItem("study_sync_guest_tasks", JSON.stringify(tasks));
    notifyGuestSubscribers();
    return newTaskId;
  }

  const colRef = collection(db, "tasks");
  const docRef = await addDoc(colRef, {
    ...task,
    dueDate: task.dueDate ? Timestamp.fromDate(task.dueDate) : null,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateTaskStatus = async (taskId: string, status: Task["status"]) => {
  if (taskId.startsWith("guest_task_")) {
    const tasks = getGuestTasksFromStorage();
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status } : t));
    localStorage.setItem("study_sync_guest_tasks", JSON.stringify(updated));
    notifyGuestSubscribers();
    return;
  }

  const docRef = doc(db, "tasks", taskId);
  await updateDoc(docRef, { status });
};

export const updateTask = async (taskId: string, updates: Partial<Omit<Task, "id" | "userId" | "createdAt">>) => {
  if (taskId.startsWith("guest_task_")) {
    const tasks = getGuestTasksFromStorage();
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          ...updates,
          // Handle explicit null update for dueDate
          dueDate: updates.dueDate !== undefined ? updates.dueDate : t.dueDate
        };
      }
      return t;
    });
    localStorage.setItem("study_sync_guest_tasks", JSON.stringify(updated));
    notifyGuestSubscribers();
    return;
  }

  const docRef = doc(db, "tasks", taskId);
  const data: any = { ...updates };
  if (updates.dueDate) {
    data.dueDate = Timestamp.fromDate(updates.dueDate);
  } else if (updates.dueDate === null) {
    data.dueDate = null;
  }
  await updateDoc(docRef, data);
};

export const deleteTask = async (taskId: string) => {
  if (taskId.startsWith("guest_task_")) {
    const tasks = getGuestTasksFromStorage();
    const filtered = tasks.filter((t) => t.id !== taskId);
    localStorage.setItem("study_sync_guest_tasks", JSON.stringify(filtered));
    notifyGuestSubscribers();
    return;
  }

  const docRef = doc(db, "tasks", taskId);
  await deleteDoc(docRef);
};
