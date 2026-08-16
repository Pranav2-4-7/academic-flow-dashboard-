import { Client } from "@notionhq/client";
import { Timestamp } from "firebase-admin/firestore"; // use admin sdk timestamp
import { adminDb } from "@/lib/firebase-admin"; // server admin SDK helper

export const syncNotionTasks = async (
  userId: string,
  notionToken: string,
  databaseId: string
) => {
  const notion = new Client({ auth: notionToken });

  // 1. Query the Notion database (bypassing Client SDK databases query typing conflict)
  const response = await (notion.databases as any).query({
    database_id: databaseId,
  });

  const notionTasks = (response.results || []).map((page: any) => {
    const props = page.properties;
    
    // Title mapping (find Title property type title)
    let title = "Untitled Notion Task";
    const titleKey = Object.keys(props).find(key => props[key].type === "title");
    if (titleKey && props[titleKey].title && props[titleKey].title[0]) {
      title = props[titleKey].title[0].plain_text;
    }

    // Due date mapping (find Date property type date)
    let dueDate: Date | null = null;
    const dateKey = Object.keys(props).find(key => props[key].type === "date");
    if (dateKey && props[dateKey].date && props[dateKey].date.start) {
      dueDate = new Date(props[dateKey].date.start);
    }

    // Status mapping (find select or status property)
    let status: "todo" | "in_progress" | "done" = "todo";
    const statusKey = Object.keys(props).find(key => props[key].type === "status" || props[key].type === "select");
    if (statusKey) {
      const propVal = props[statusKey];
      const statusName = (propVal.status?.name || propVal.select?.name || "").toLowerCase();
      if (statusName.includes("progress") || statusName.includes("doing") || statusName.includes("active")) {
        status = "in_progress";
      } else if (statusName.includes("done") || statusName.includes("complete") || statusName.includes("finish")) {
        status = "done";
      }
    }

    // Description mapping (find rich_text or page URL)
    let description = `Synced from Notion Page: ${page.url}`;
    const textKey = Object.keys(props).find(key => props[key].type === "rich_text");
    if (textKey && props[textKey].rich_text && props[textKey].rich_text[0]) {
      description = props[textKey].rich_text[0].plain_text;
    }

    return {
      notionId: page.id,
      title,
      dueDate,
      status,
      description,
    };
  });

  // 2. Fetch existing Notion tasks for this user from Firestore to avoid duplicates
  const tasksCol = adminDb.collection("tasks");
  const snapshot = await tasksCol
    .where("userId", "==", userId)
    .where("source", "==", "notion")
    .get();

  const existingMap = new Map<string, string>(); // notionId -> firestoreId
  const existingCompletedMap = new Map<string, boolean>(); // notionId -> isCompletedInFirestore
  
  snapshot.forEach((doc: any) => {
    const data = doc.data();
    if (data.notionId) {
      existingMap.set(data.notionId, doc.id);
      existingCompletedMap.set(data.notionId, data.status === "done");
    }
  });

  // 3. Batch write task upserts
  const batch = adminDb.batch();
  
  for (const t of notionTasks) {
    const existingId = existingMap.get(t.notionId);
    
    if (existingId) {
      // If task exists, we update it but preserve user status if marked done locally
      const isDoneLocally = existingCompletedMap.get(t.notionId);
      
      const docRef = tasksCol.doc(existingId);
      batch.update(docRef, {
        title: t.title,
        description: t.description,
        dueDate: t.dueDate ? Timestamp.fromDate(t.dueDate) : null,
        // Only override status if they haven't marked it completed locally
        status: isDoneLocally ? "done" : t.status,
        updatedAt: Timestamp.now(),
      });
    } else {
      // Insert new task
      const docRef = tasksCol.doc(); // Auto-id
      batch.set(docRef, {
        userId,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate ? Timestamp.fromDate(t.dueDate) : null,
        status: t.status,
        category: "Notion",
        source: "notion",
        notionId: t.notionId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  }

  await batch.commit();
  return notionTasks.length;
};
