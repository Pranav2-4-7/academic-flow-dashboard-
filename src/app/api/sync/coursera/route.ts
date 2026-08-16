import { NextRequest, NextResponse } from "next/server";
import ical from "node-ical";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { userId, icsUrl } = await req.json();

    if (!userId || !icsUrl) {
      return NextResponse.json(
        { error: "Missing required parameters: userId and icsUrl" },
        { status: 400 }
      );
    }

    // 1. Fetch the .ics file content
    const response = await fetch(icsUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to download the Coursera ICS calendar. Check if the URL is valid." },
        { status: 400 }
      );
    }
    const icsText = await response.text();

    // 2. Parse the calendar using node-ical
    const parsedData = ical.parseICS(icsText);
    
    // Save ICS URL under the user document for future auto-syncing
    await adminDb.collection("users").doc(userId).set({
      courseraIcsUrl: icsUrl
    }, { merge: true });

    // 3. Batch sync events to Firestore
    const batch = adminDb.batch();
    let syncCount = 0;

    for (const key in parsedData) {
      const item = parsedData[key] as any;
      if (item && item.type === "VEVENT" && item.start) {
        const eventStart = new Date(item.start);
        
        // Form a safe partition-unique ID for the task document
        const taskId = `${userId}_${item.uid || key}`;
        const taskDocRef = adminDb.collection("tasks").doc(taskId);

        // Fetch task details if it exists to preserve status
        const existingDoc = await taskDocRef.get();
        const existingData = existingDoc.exists ? existingDoc.data() : null;

        const taskData = {
          userId,
          title: item.summary || "Coursera Task",
          description: item.description || "",
          dueDate: Timestamp.fromDate(eventStart),
          category: "Coursera",
          status: existingData?.status || "todo",
          source: "coursera",
          createdAt: existingData?.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        batch.set(taskDocRef, taskData);
        syncCount++;
      }
    }

    if (syncCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncCount} Coursera deadlines.`,
      count: syncCount
    });

  } catch (error: any) {
    console.error("Coursera Sync Error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during ICS synchronization." },
      { status: 500 }
    );
  }
}
