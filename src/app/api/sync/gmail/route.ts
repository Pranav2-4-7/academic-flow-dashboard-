import { NextRequest, NextResponse } from "next/server";
import { syncGmailClassesToFirestore } from "@/lib/services/gmail";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const tasks = await syncGmailClassesToFirestore(userId);
    
    console.log(`[GMAIL SYNC] Successfully synced ${tasks.length} live classes/webinars for user ${userId}`);

    return NextResponse.json({
      success: true,
      count: tasks.length,
      message: `Successfully synced ${tasks.length} live classes and webinars from your Gmail!`,
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        joinUrl: t.joinUrl
      }))
    });

  } catch (error: any) {
    console.error("Gmail Sync Route Error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to sync Gmail live classes" 
    }, { status: 500 });
  }
}
