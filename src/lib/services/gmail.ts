import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export interface GmailClassEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
}

export interface ExtractedLiveClass {
  id: string;
  title: string;
  joinUrl: string;
  webinarId?: string;
  passcode?: string;
  scheduledDate: Date;
  description: string;
}

function parseClassEmail(subject: string, htmlText: string, plainText: string, fallbackDate: string): ExtractedLiveClass | null {
  const fullText = (htmlText + " " + plainText)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

  // 1. Extract Zoom / Google Meet / Teams link
  let joinUrl = "";
  // Direct webinar / meeting join link priority
  const directZoomMatch = htmlText.match(/https?:\/\/[a-zA-Z0-9.-]*zoom\.us\/[wj]\/[^\s"'<>]+/i);
  if (directZoomMatch) {
    joinUrl = directZoomMatch[0];
  } else {
    const anyMeetMatch = htmlText.match(/https?:\/\/(?:[a-zA-Z0-9.-]*zoom\.us\/(?:j|w|my|meeting)\/[^\s"'<>]+|meet\.google\.com\/[a-z-]+|teams\.microsoft\.com\/[^\s"'<>]+)/i);
    if (anyMeetMatch) {
      joinUrl = anyMeetMatch[0];
    }
  }

  // 2. Extract Webinar ID & Passcode
  const webinarIdMatch = fullText.match(/Webinar\s*ID[:\s]+([0-9\s]+)/i) || fullText.match(/Meeting\s*ID[:\s]+([0-9\s]+)/i);
  const webinarId = webinarIdMatch ? webinarIdMatch[1].trim() : undefined;

  const passcodeMatch = fullText.match(/Passcode[:\s]+([a-zA-Z0-9]+)/i) || fullText.match(/Password[:\s]+([a-zA-Z0-9]+)/i);
  const passcode = passcodeMatch ? passcodeMatch[1].trim() : undefined;

  // 3. Extract Scheduled Date & Time
  let scheduledDate: Date | null = null;
  const dateTimeMatch = fullText.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\s+(?:at\s+)?\d{1,2}[:.]\d{2}\s*(?:AM|PM)(?:\s+India)?)/i);

  if (dateTimeMatch) {
    let rawDateStr = dateTimeMatch[1].replace(/India/i, "").trim();
    // Use IST timezone (+05:30) if "India" or default
    const parsed = new Date(rawDateStr + " GMT+0530");
    if (!isNaN(parsed.getTime())) {
      scheduledDate = parsed;
    }
  }

  if (!scheduledDate && fallbackDate) {
    const fb = new Date(fallbackDate);
    if (!isNaN(fb.getTime())) {
      scheduledDate = fb;
    }
  }

  if (!scheduledDate) {
    scheduledDate = new Date();
  }

  // Check if this looks like a live class / webinar / workshop
  const isClassEmail = 
    joinUrl || 
    webinarId || 
    /webinar|workshop|live\s*class|zoom|google\s*meet/i.test(subject) ||
    /webinar|workshop|live\s*class|zoom/i.test(fullText.substring(0, 500));

  if (!isClassEmail) {
    return null;
  }

  // 4. Extract clean title
  let cleanTitle = subject
    .replace(/^Fwd:\s*/i, "")
    .replace(/^Re:\s*/i, "")
    .replace(/\s*Confirmation$/i, "")
    .replace(/\s*Invitation:\s*/i, "")
    .trim();

  const descSummary = fullText.substring(0, 300).trim();
  const description = `${joinUrl ? `Join Link: ${joinUrl}\n` : ""}${webinarId ? `Webinar ID: ${webinarId} ` : ""}${passcode ? `| Passcode: ${passcode}\n` : "\n"}${descSummary}...`;

  return {
    id: "",
    title: cleanTitle || "Live Class / Webinar",
    joinUrl,
    webinarId,
    passcode,
    scheduledDate,
    description,
  };
}

export const fetchGmailLiveClasses = async (userId: string): Promise<GmailClassEmail[]> => {
  // 1. Fetch Google OAuth tokens from Firestore
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error("User document does not exist");
  }

  const userData = userDoc.data();
  const tokens = userData?.googleOAuthToken;

  if (!tokens) {
    throw new Error("Google OAuth credentials not found. Please connect your Gmail account in Settings.");
  }

  // 2. Set up Google Auth Client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`
  );

  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    await adminDb.collection("users").doc(userId).set({
      googleOAuthToken: {
        ...tokens,
        ...newTokens,
      }
    }, { merge: true });
  });

  // 3. Query Gmail API with comprehensive search
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const q = 'webinar OR zoom OR "live class" OR "Workshop" OR meet.google.com';
  
  const response = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: 15,
  });

  const messages = response.data.messages || [];
  const list: GmailClassEmail[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    
    try {
      const msgDetail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const headers = msgDetail.data.payload?.headers || [];
      const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "No Subject";
      const from = headers.find(h => h.name?.toLowerCase() === "from")?.value || "Unknown Sender";
      const date = headers.find(h => h.name?.toLowerCase() === "date")?.value || "";
      
      let htmlBody = "";
      let plainBody = "";

      function extractParts(part: any) {
        if (!part) return;
        if (part.parts && Array.isArray(part.parts)) {
          for (const p of part.parts) {
            extractParts(p);
          }
        }
        if (part.body && part.body.data) {
          const decoded = Buffer.from(part.body.data, "base64").toString("utf-8");
          if (part.mimeType === "text/html") {
            htmlBody += " " + decoded;
          } else if (part.mimeType === "text/plain") {
            plainBody += " " + decoded;
          }
        }
      }

      extractParts(msgDetail.data.payload);

      list.push({
        id: msg.id,
        threadId: msg.threadId || "",
        subject,
        from,
        date,
        snippet: msgDetail.data.snippet || "",
        body: htmlBody || plainBody || "",
      });
    } catch (err) {
      console.error(`Failed to fetch details for message ID ${msg.id}:`, err);
    }
  }

  return list;
};

export const syncGmailClassesToFirestore = async (userId: string) => {
  const emails = await fetchGmailLiveClasses(userId);
  const tasksCol = adminDb.collection("tasks");
  const syncedTasks = [];

  // Query existing tasks for user to prevent duplicate insertions
  const existingTasksSnap = await tasksCol
    .where("userId", "==", userId)
    .where("source", "==", "gmail")
    .get();

  const existingExternalIds = new Map<string, string>();
  existingTasksSnap.forEach(doc => {
    const data = doc.data();
    if (data.externalId) {
      existingExternalIds.set(data.externalId, doc.id);
    }
  });

  for (const email of emails) {
    const parsed = parseClassEmail(email.subject, email.body, email.snippet, email.date);
    if (!parsed || (!parsed.joinUrl && !parsed.webinarId)) continue;

    const taskData = {
      userId,
      title: parsed.title,
      description: parsed.description,
      dueDate: Timestamp.fromDate(parsed.scheduledDate),
      category: "Gmail",
      status: "todo",
      source: "gmail",
      externalId: email.id,
      joinUrl: parsed.joinUrl || "",
      webinarId: parsed.webinarId || "",
      updatedAt: Timestamp.now(),
    };

    if (existingExternalIds.has(email.id)) {
      const existingDocId = existingExternalIds.get(email.id)!;
      await tasksCol.doc(existingDocId).update(taskData);
      syncedTasks.push({ id: existingDocId, ...taskData });
    } else {
      const docRef = await tasksCol.add({
        ...taskData,
        createdAt: Timestamp.now(),
      });
      syncedTasks.push({ id: docRef.id, ...taskData });
    }
  }

  return syncedTasks;
};
