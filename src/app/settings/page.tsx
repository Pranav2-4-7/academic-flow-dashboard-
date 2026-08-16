"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Navigation } from "@/components/Navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function SettingsContent() {
  const { user, loading, courseraIcsUrl, updateCourseraIcsUrl, isGuest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Settings State
  const [icsInput, setIcsInput] = useState("");
  const [isSyncingIcs, setIsSyncingIcs] = useState(false);
  const [icsSyncMessage, setIcsSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [gmailSyncMessage, setGmailSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notion Integration State
  const [notionToken, setNotionToken] = useState("");
  const [notionDbId, setNotionDbId] = useState("");
  const [isNotionConnected, setIsNotionConnected] = useState(false);
  const [isSyncingNotion, setIsSyncingNotion] = useState(false);
  const [notionSyncMessage, setNotionSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Sync state parameters from redirect URL (only relevant for Firebase mode)
  useEffect(() => {
    const oauthStatus = searchParams.get("gmail_sync");
    if (oauthStatus === "success") {
      setGmailSyncMessage({ type: "success", text: "Successfully authorized Google account!" });
    } else if (oauthStatus === "error") {
      setGmailSyncMessage({ type: "error", text: "Failed to authorize Google account." });
    }
  }, [searchParams]);

  // Initialize data
  useEffect(() => {
    if (courseraIcsUrl) {
      setIcsInput(courseraIcsUrl);
    }
    
    // Check connection statuses
    const checkConnections = async () => {
      if (!user) return;
      
      // Guest Mode Simulation Connections
      if (isGuest) {
        const gmailConnected = localStorage.getItem("study_sync_guest_gmail_connected");
        if (gmailConnected === "true") {
          setIsGmailConnected(true);
        }
        
        const notionConnected = localStorage.getItem("study_sync_guest_notion_connected");
        if (notionConnected === "true") {
          setIsNotionConnected(true);
          setNotionToken(localStorage.getItem("study_sync_guest_notion_token") || "");
          setNotionDbId(localStorage.getItem("study_sync_guest_notion_db") || "");
        }
        return;
      }

      // Real Firebase Mode Connections
      try {
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.googleOAuthToken) {
            setIsGmailConnected(true);
          }
          if (data.notionIntegrationToken && data.notionDatabaseId) {
            setIsNotionConnected(true);
            setNotionToken(data.notionIntegrationToken);
            setNotionDbId(data.notionDatabaseId);
          }
        }
      } catch (error) {
        console.error("Error checking database connection status:", error);
      }
    };
    checkConnections();
  }, [user, courseraIcsUrl, isGuest]);

  // Sync Coursera ICS
  const handleIcsSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !icsInput.trim()) return;

    setIsSyncingIcs(true);
    setIcsSyncMessage(null);

    // Guest Mode Simulation
    if (isGuest) {
      try {
        await updateCourseraIcsUrl(icsInput);
        // Simulate network parsing latency
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        const mockCourseraTasks = [
          {
            id: "guest_task_coursera_1",
            userId: "guest_user",
            title: "Algorithms: Divide and Conquer Quiz",
            description: "Week 2 Review Quiz - Imported from Coursera Calendar",
            dueDate: today,
            category: "Coursera" as const,
            status: "todo" as const,
            source: "coursera" as const,
            createdAt: today,
          },
          {
            id: "guest_task_coursera_2",
            userId: "guest_user",
            title: "Machine Learning: Linear Regression Quiz",
            description: "Vectorized Implementations Quiz - Imported from Coursera Calendar",
            dueDate: nextWeek,
            category: "Coursera" as const,
            status: "todo" as const,
            source: "coursera" as const,
            createdAt: today,
          },
        ];

        const existingTasksData = localStorage.getItem("study_sync_guest_tasks");
        const currentTasks = existingTasksData ? JSON.parse(existingTasksData) : [];
        
        const filtered = currentTasks.filter((t: any) => !t.id.startsWith("guest_task_coursera_"));
        const updatedTasks = [...filtered, ...mockCourseraTasks];
        localStorage.setItem("study_sync_guest_tasks", JSON.stringify(updatedTasks));
        
        window.dispatchEvent(new Event("storage"));
        
        setIcsSyncMessage({
          type: "success",
          text: "Successfully parsed 2 Coursera deadlines (Mocked for Guest)!",
        });
      } catch (error) {
        setIcsSyncMessage({ type: "error", text: "Failed to update local calendar url." });
      } finally {
        setIsSyncingIcs(false);
      }
      return;
    }

    // Real Firebase mode
    try {
      await updateCourseraIcsUrl(icsInput);

      const response = await fetch("/api/sync/coursera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, icsUrl: icsInput }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setIcsSyncMessage({
          type: "success",
          text: data.message || "Successfully synced Coursera deadlines!"
        });
      } else {
        setIcsSyncMessage({
          type: "error",
          text: data.error || "Failed to parse calendar."
        });
      }
    } catch (error) {
      setIcsSyncMessage({
        type: "error",
        text: "Network error occurred while syncing calendar."
      });
    } finally {
      setIsSyncingIcs(false);
    }
  };

  // Authenticate Google account
  const handleConnectGmail = () => {
    if (!user) return;

    if (isGuest) {
      localStorage.setItem("study_sync_guest_gmail_connected", "true");
      setIsGmailConnected(true);
      setGmailSyncMessage({ 
        type: "success", 
        text: "Successfully authorized Google account (Mocked for Guest)!" 
      });
      return;
    }

    // Redirect to auth endpoint which triggers consent flow
    window.location.href = `/api/auth/google?userId=${user.uid}`;
  };

  // Sync Gmail
  const handleGmailSync = async () => {
    if (!user) return;
    setIsSyncingGmail(true);
    setGmailSyncMessage(null);

    // Guest Mode Simulation
    if (isGuest) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        const today = new Date();
        const twoHoursLater = new Date(today.getTime() + 2 * 60 * 60 * 1000);
        
        const mockGmailTask = {
          id: "guest_task_gmail_1",
          userId: "guest_user",
          title: "Live Class: Graph Algorithms (Zoom)",
          description: "Zoom URL: https://zoom.us/j/987654321 (Passcode: study101) - Extracted from Google Mail",
          dueDate: twoHoursLater,
          category: "Gmail" as const,
          status: "todo" as const,
          source: "gmail" as const,
          createdAt: today,
        };

        const existingTasksData = localStorage.getItem("study_sync_guest_tasks");
        const currentTasks = existingTasksData ? JSON.parse(existingTasksData) : [];
        
        const filtered = currentTasks.filter((t: any) => !t.id.startsWith("guest_task_gmail_"));
        const updatedTasks = [...filtered, mockGmailTask];
        localStorage.setItem("study_sync_guest_tasks", JSON.stringify(updatedTasks));
        
        window.dispatchEvent(new Event("storage"));
        
        setGmailSyncMessage({
          type: "success",
          text: "Successfully synced 1 upcoming live class from Gmail (Mocked for Guest)!",
        });
      } catch (error) {
        setGmailSyncMessage({ type: "error", text: "Failed to parse local email details." });
      } finally {
        setIsSyncingGmail(false);
      }
      return;
    }

    // Real Firebase mode
    try {
      const response = await fetch("/api/sync/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await response.json();

      if (response.ok) {
        setGmailSyncMessage({
          type: "success",
          text: data.message || "Successfully synchronized Gmail classes."
        });
      } else {
        setGmailSyncMessage({
          type: "error",
          text: data.error || "Failed to scan emails."
        });
      }
    } catch (error) {
      setGmailSyncMessage({
        type: "error",
        text: "Network error occurred while scanning mail."
      });
    } finally {
      setIsSyncingGmail(false);
    }
  };

  // Connect Notion Integration
  const handleConnectNotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !notionToken.trim() || !notionDbId.trim()) return;

    setNotionSyncMessage(null);

    // Guest Mode Simulation
    if (isGuest) {
      localStorage.setItem("study_sync_guest_notion_connected", "true");
      localStorage.setItem("study_sync_guest_notion_token", notionToken.trim());
      localStorage.setItem("study_sync_guest_notion_db", notionDbId.trim());
      setIsNotionConnected(true);
      setNotionSyncMessage({
        type: "success",
        text: "Successfully linked Notion integration (Mocked for Guest)!",
      });
      return;
    }

    // Real Firebase Mode
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          notionIntegrationToken: notionToken.trim(),
          notionDatabaseId: notionDbId.trim(),
        },
        { merge: true }
      );
      setIsNotionConnected(true);
      setNotionSyncMessage({
        type: "success",
        text: "Successfully saved Notion integration credentials!",
      });
    } catch (error) {
      console.error("Failed to connect Notion database:", error);
      setNotionSyncMessage({
        type: "error",
        text: "Failed to connect to database. Try again.",
      });
    }
  };

  // Sync Notion Database
  const handleNotionSync = async () => {
    if (!user) return;
    setIsSyncingNotion(true);
    setNotionSyncMessage(null);

    // Guest Mode Simulation
    if (isGuest) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        const mockNotionTasks = [
          {
            id: "guest_task_notion_1",
            userId: "guest_user",
            title: "Read Notion Chapter 5 (Microservices)",
            description: "Study distributed systems patterns and design - Synced from Notion",
            dueDate: null, // Unscheduled for drag/drop demo!
            category: "Notion" as const,
            status: "todo" as const,
            source: "notion" as const,
            createdAt: today,
          },
          {
            id: "guest_task_notion_2",
            userId: "guest_user",
            title: "Draft Thesis Architecture Proposal",
            description: "Sketch component interactions - Synced from Notion",
            dueDate: null, // Unscheduled for drag/drop demo!
            category: "Notion" as const,
            status: "todo" as const,
            source: "notion" as const,
            createdAt: today,
          },
          {
            id: "guest_task_notion_3",
            userId: "guest_user",
            title: "Submit Literature Review Summary",
            description: "Aggregate references - Synced from Notion",
            dueDate: nextWeek, // Pre-scheduled
            category: "Notion" as const,
            status: "in_progress" as const,
            source: "notion" as const,
            createdAt: today,
          },
        ];

        const existingTasksData = localStorage.getItem("study_sync_guest_tasks");
        const currentTasks = existingTasksData ? JSON.parse(existingTasksData) : [];
        
        // Filter out existing guest_task_notion_ tasks to allow repeat sync runs
        const filtered = currentTasks.filter((t: any) => !t.id.startsWith("guest_task_notion_"));
        const updatedTasks = [...filtered, ...mockNotionTasks];
        localStorage.setItem("study_sync_guest_tasks", JSON.stringify(updatedTasks));
        
        window.dispatchEvent(new Event("storage"));
        
        setNotionSyncMessage({
          type: "success",
          text: "Successfully synced 3 items from Notion (Mocked for Guest)!",
        });
      } catch (error) {
        setNotionSyncMessage({ type: "error", text: "Failed to sync Notion details." });
      } finally {
        setIsSyncingNotion(false);
      }
      return;
    }

    // Real Firebase mode
    try {
      const response = await fetch("/api/sync/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await response.json();

      if (response.ok) {
        setNotionSyncMessage({
          type: "success",
          text: data.message || "Successfully synchronized Notion tasks."
        });
      } else {
        setNotionSyncMessage({
          type: "error",
          text: data.error || "Failed to scan Notion database."
        });
      }
    } catch (error: any) {
      setNotionSyncMessage({
        type: "error",
        text: error.message || "Network error occurred while syncing Notion."
      });
    } finally {
      setIsSyncingNotion(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-on-surface">
        <div className="flex flex-col items-center gap-md">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          <span className="font-label-md text-label-md tracking-wider">LOADING StudySync...</span>
        </div>
      </div>
    );
  }

  return (
    <Navigation activeTab="settings">
      <header className="bg-surface border-b border-outline-variant z-10 shrink-0">
        <div className="flex justify-between items-center w-full px-md h-16 max-w-[1200px] mx-auto">
          <span className="font-h2 text-h2 text-on-surface font-bold">Settings</span>
        </div>
      </header>

      <main className="p-md md:p-xl">
        <div className="max-w-[800px] mx-auto flex flex-col gap-lg">
          
          {/* Coursera Integration Card */}
          <div className="bg-surface-container rounded-xl border border-outline-variant p-lg shadow-sm">
            <h3 className="font-h3 text-h3 text-on-surface mb-sm font-semibold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary text-[22px]">school</span>
              Coursera Calendar Integration
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-md">
              Sync your Coursera course deadlines directly to your StudySync calendar by providing your personal iCal calendar link.
            </p>
            
            <form onSubmit={handleIcsSync} className="flex flex-col gap-sm">
              <div className="flex flex-col sm:flex-row gap-sm items-stretch">
                <input
                  type="url"
                  required
                  placeholder="https://coursera.org/api/calendar/v1/..."
                  className="bg-surface text-on-surface border border-outline-variant rounded p-sm flex-1 focus:border-primary focus:outline-none"
                  value={icsInput}
                  onChange={(e) => setIcsInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isSyncingIcs}
                  className="bg-[#507DBC] text-white hover:bg-[#436ca3] font-label-md text-label-md px-md py-sm rounded-lg transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSyncingIcs ? "Syncing..." : "Sync Calendar"}
                </button>
              </div>
            </form>

            {icsSyncMessage && (
              <div className={`mt-md p-sm rounded font-label-md text-label-md ${
                icsSyncMessage.type === "success" ? "bg-secondary-container/20 text-secondary border border-secondary" : "bg-error-container/20 text-error border border-error"
              }`}>
                {icsSyncMessage.text}
              </div>
            )}
          </div>

          {/* Google Account Gmail integration Card */}
          <div className="bg-surface-container rounded-xl border border-outline-variant p-lg shadow-sm">
            <h3 className="font-h3 text-h3 text-on-surface mb-sm font-semibold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary text-[22px]">mail</span>
              Google Gmail Integration
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-md">
              Connect your Google account to scan class emails. Connecting authorizes read-only access to automatically detect upcoming live classes, Zoom links, and assignments.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md border-t border-outline-variant/30 pt-md">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface">Connection Status</span>
                <span className={`font-body-sm text-body-sm font-semibold mt-xs ${
                  isGmailConnected ? "text-secondary" : "text-on-surface-variant"
                }`}>
                  {isGmailConnected ? "Connected to Gmail (Read-Only)" : "Not Connected"}
                </span>
              </div>

              <div className="flex gap-sm">
                <button
                  onClick={handleConnectGmail}
                  className={`font-label-md text-label-md px-md py-sm rounded-lg border transition-colors cursor-pointer active:scale-95 ${
                    isGmailConnected 
                      ? "bg-surface-variant hover:bg-surface-bright text-on-surface border-outline-variant"
                      : "bg-[#507DBC] text-white hover:bg-[#436ca3] border-[#507DBC]"
                  }`}
                >
                  {isGmailConnected ? "Reconnect Google" : "Connect Google"}
                </button>

                {isGmailConnected && (
                  <button
                    onClick={handleGmailSync}
                    disabled={isSyncingGmail}
                    className="bg-[#507DBC] text-white hover:bg-[#436ca3] font-label-md text-label-md px-md py-sm rounded-lg transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isSyncingGmail ? "Scanning..." : "Scan Mail Now"}
                  </button>
                )}
              </div>
            </div>

            {gmailSyncMessage && (
              <div className={`mt-md p-sm rounded font-label-md text-label-md ${
                gmailSyncMessage.type === "success" ? "bg-secondary-container/20 text-secondary border border-secondary" : "bg-error-container/20 text-error border border-error"
              }`}>
                {gmailSyncMessage.text}
              </div>
            )}
          </div>

          {/* Notion Database integration Card */}
          <div className="bg-surface-container rounded-xl border border-outline-variant p-lg shadow-sm">
            <h3 className="font-h3 text-h3 text-on-surface mb-sm font-semibold flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary text-[22px]">description</span>
              Notion Workspace Integration
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-md">
              Sync tasks and assignments from your Notion database directly. Connect your integration and database ID to schedule them onto the calendar.
            </p>

            <form onSubmit={handleConnectNotion} className="flex flex-col gap-sm pt-md border-t border-outline-variant/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant">Notion Integration Token</label>
                  <input
                    type="password"
                    required
                    placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none"
                    value={notionToken}
                    onChange={(e) => setNotionToken(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant">Notion Database ID</label>
                  <input
                    type="text"
                    required
                    placeholder="32-character hex database id"
                    className="bg-surface text-on-surface border border-outline-variant rounded p-sm focus:border-primary focus:outline-none"
                    value={notionDbId}
                    onChange={(e) => setNotionDbId(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md mt-sm border-t border-outline-variant/10 pt-sm">
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface">Connection Status</span>
                  <span className={`font-body-sm text-body-sm font-semibold mt-xs ${
                    isNotionConnected ? "text-secondary" : "text-on-surface-variant"
                  }`}>
                    {isNotionConnected ? "Credentials Configured" : "Not Connected"}
                  </span>
                </div>

                <div className="flex gap-sm">
                  <button
                    type="submit"
                    className={`font-label-md text-label-md px-md py-sm rounded-lg border transition-colors cursor-pointer active:scale-95 ${
                      isNotionConnected 
                        ? "bg-surface-variant hover:bg-surface-bright text-on-surface border-outline-variant"
                        : "bg-[#507DBC] text-white hover:bg-[#436ca3] border-[#507DBC]"
                    }`}
                  >
                    {isNotionConnected ? "Update Credentials" : "Link Integration"}
                  </button>

                  {isNotionConnected && (
                    <button
                      type="button"
                      onClick={handleNotionSync}
                      disabled={isSyncingNotion}
                      className="bg-[#507DBC] text-white hover:bg-[#436ca3] font-label-md text-label-md px-md py-sm rounded-lg transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isSyncingNotion ? "Syncing..." : "Sync Database Now"}
                    </button>
                  )}
                </div>
              </div>
            </form>

            {notionSyncMessage && (
              <div className={`mt-md p-sm rounded font-label-md text-label-md ${
                notionSyncMessage.type === "success" ? "bg-secondary-container/20 text-secondary border border-secondary" : "bg-error-container/20 text-error border border-error"
              }`}>
                {notionSyncMessage.text}
              </div>
            )}
          </div>

        </div>
      </main>
    </Navigation>
  );
}

export default function Settings() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background text-on-surface">
        <div className="flex flex-col items-center gap-md">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          <span className="font-label-md text-label-md tracking-wider">LOADING SETTINGS...</span>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
