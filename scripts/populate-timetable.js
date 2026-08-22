const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

// Simple parser for .env.local to avoid needing dotenv
const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const parts = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (parts) {
    let value = parts[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[parts[1]] = value;
  }
});

const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : "";

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase configuration in .env.local");
  process.exit(1);
}

const adminApp = initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = getFirestore(adminApp);
const userId = "WdGLFXlKGWZ4BrPCBSZr8CERpjV2";

const subjects = [
  "CM",
  "CM Lab",
  "OOPs",
  "OOPs Lab",
  "DLCD",
  "DLCD Lab",
  "DS",
  "DS Lab",
  "DM"
];

const timetable = [
  // Monday
  { day: "Monday", subjectName: "CM", time: "09:00", type: "lecture" },
  { day: "Monday", subjectName: "DS Lab", time: "10:00", type: "lab" },
  { day: "Monday", subjectName: "DS Lab", time: "11:00", type: "lab" },
  { day: "Monday", subjectName: "OOPs", time: "12:30", type: "lecture" },
  { day: "Monday", subjectName: "DLCD", time: "13:30", type: "lecture" },

  // Tuesday
  { day: "Tuesday", subjectName: "DM", time: "09:00", type: "lecture" },
  { day: "Tuesday", subjectName: "OOPs Lab", time: "10:00", type: "lab" },
  { day: "Tuesday", subjectName: "OOPs Lab", time: "11:00", type: "lab" },
  { day: "Tuesday", subjectName: "CM", time: "12:30", type: "lecture" },
  { day: "Tuesday", subjectName: "DS", time: "13:30", type: "lecture" },
  { day: "Tuesday", subjectName: "DLCD", time: "14:30", type: "lecture" },

  // Wednesday
  { day: "Wednesday", subjectName: "DLCD Lab", time: "10:00", type: "lab" },
  { day: "Wednesday", subjectName: "DLCD Lab", time: "11:00", type: "lab" },
  { day: "Wednesday", subjectName: "DM", time: "12:30", type: "lecture" },
  { day: "Wednesday", subjectName: "DS", time: "13:30", type: "lecture" },

  // Thursday
  { day: "Thursday", subjectName: "CM Lab", time: "08:00", type: "lab" },
  { day: "Thursday", subjectName: "CM Lab", time: "09:00", type: "lab" },
  { day: "Thursday", subjectName: "CM", time: "10:00", type: "lecture" },
  { day: "Thursday", subjectName: "OOPs", time: "11:00", type: "lecture" },
  { day: "Thursday", subjectName: "DS", time: "12:30", type: "lecture" },
  { day: "Thursday", subjectName: "DM", time: "13:30", type: "lecture" },
  { day: "Thursday", subjectName: "DLCD", time: "14:30", type: "lecture" },

  // Friday
  { day: "Friday", subjectName: "DM", time: "09:00", type: "lecture" },
  { day: "Friday", subjectName: "CM", time: "10:00", type: "lecture" },
  { day: "Friday", subjectName: "DLCD", time: "11:00", type: "lecture" },
  { day: "Friday", subjectName: "OOPs", time: "12:30", type: "lecture" },
  { day: "Friday", subjectName: "DS", time: "13:30", type: "lecture" }
];

async function run() {
  console.log("Starting database population for user:", userId);

  // 1. Get existing subjects to avoid duplicates
  const subSnap = await db.collection("subjects").where("userId", "==", userId).get();
  const existingNames = new Set();
  subSnap.forEach((d) => existingNames.add(d.data().name.toLowerCase()));

  for (const name of subjects) {
    if (!existingNames.has(name.toLowerCase())) {
      console.log("Adding subject to database:", name);
      await db.collection("subjects").add({
        userId,
        name,
        present: 0,
        absent: 0,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 2. Clear old timetable slots for user
  const timetableSnap = await db.collection("timetable").where("userId", "==", userId).get();
  console.log(`Clearing ${timetableSnap.size} existing timetable slots...`);
  
  if (timetableSnap.size > 0) {
    const batch = db.batch();
    timetableSnap.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  }

  // 3. Add new timetable slots
  console.log("Adding new timetable slots...");
  for (const slot of timetable) {
    await db.collection("timetable").add({
      userId,
      ...slot,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log("Database successfully populated with your timetable!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error populating database:", err);
  process.exit(1);
});
