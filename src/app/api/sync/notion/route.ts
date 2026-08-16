import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { syncNotionTasks } from "@/lib/services/notion";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID parameter" }, { status: 400 });
    }

    // Retrieve user credentials from Firestore
    const userDoc = await adminDb.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User profile not found in database" }, { status: 404 });
    }

    const userData = userDoc.data();
    const notionToken = userData?.notionIntegrationToken;
    const databaseId = userData?.notionDatabaseId;

    if (!notionToken || !databaseId) {
      return NextResponse.json(
        { error: "Notion credentials not found. Configure them in Settings." },
        { status: 400 }
      );
    }

    // Sync tasks
    const count = await syncNotionTasks(userId, notionToken, databaseId);

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${count} task${count === 1 ? "" : "s"} from Notion!`,
    });
  } catch (error: any) {
    console.error("Notion Sync Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync with Notion database. Verify credentials." },
      { status: 500 }
    );
  }
}
