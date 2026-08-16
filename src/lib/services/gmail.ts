import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";

export interface GmailClassEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
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

  // Set up auto-saving when access token refreshes
  oauth2Client.on("tokens", async (newTokens) => {
    await adminDb.collection("users").doc(userId).set({
      googleOAuthToken: {
        ...tokens,
        ...newTokens,
      }
    }, { merge: true });
  });

  // 3. Query Gmail API
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  
  // Search query: subject:"live class" OR from:coursera zoom
  const q = 'subject:"live class" OR from:coursera zoom';
  
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
      
      let body = "";
      const payload = msgDetail.data.payload;
      
      if (payload) {
        if (payload.parts) {
          // Attempt to find text/plain or text/html
          const textPart = payload.parts.find(p => p.mimeType === "text/plain") || 
                           payload.parts.find(p => p.mimeType === "text/html");
          if (textPart && textPart.body?.data) {
            body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
          }
        } else if (payload.body?.data) {
          body = Buffer.from(payload.body.data, "base64").toString("utf-8");
        }
      }

      list.push({
        id: msg.id,
        threadId: msg.threadId || "",
        subject,
        from,
        date,
        snippet: msgDetail.data.snippet || "",
        body,
      });
    } catch (err) {
      console.error(`Failed to fetch details for message ID ${msg.id}:`, err);
    }
  }

  return list;
};
