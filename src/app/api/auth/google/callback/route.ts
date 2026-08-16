import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.json({ error: "Authorization code or state is missing" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens in user document
    await adminDb.collection("users").doc(userId).set({
      googleOAuthToken: tokens,
      gmailSynced: true,
    }, { merge: true });

    // Redirect to dashboard or settings page with success parameter
    const redirectUrl = new URL("/settings", req.url);
    redirectUrl.searchParams.set("gmail_sync", "success");
    return NextResponse.redirect(redirectUrl.toString());

  } catch (error: any) {
    console.error("Google OAuth Callback Error:", error);
    const redirectUrl = new URL("/settings", req.url);
    redirectUrl.searchParams.set("gmail_sync", "error");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
