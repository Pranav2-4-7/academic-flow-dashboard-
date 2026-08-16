import { NextRequest, NextResponse } from "next/server";
import { fetchGmailLiveClasses } from "@/lib/services/gmail";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const emails = await fetchGmailLiveClasses(userId);
    
    console.log(`[GMAIL SYNC] Fetched ${emails.length} matching Zoom/class emails for user ${userId}`);
    
    // As per instruction: "Stop here and wait for me to provide the Gemini API key for the extraction step."
    return NextResponse.json({
      success: true,
      message: `Gmail sync scaffolded: Fetched ${emails.length} matching emails. Ready for Gemini API Key extraction step.`,
      emails: emails.map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        date: e.date,
        snippet: e.snippet
      }))
    });

  } catch (error: any) {
    console.error("Gmail Sync Route Error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to sync Gmail live classes" 
    }, { status: 500 });
  }
}
