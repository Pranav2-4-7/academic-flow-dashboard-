"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, loading, signInWithGoogle, signInAsGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (error) {
      console.error("Sign-In failed:", error);
    }
  };

  const handleGuestLogin = () => {
    signInAsGuest();
    router.push("/dashboard");
  };

  if (loading) {
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
    <main className="flex h-screen items-center justify-center bg-background px-md">
      <div className="w-full max-w-md bg-surface-container rounded-xl border border-outline-variant p-lg flex flex-col items-center relative overflow-hidden group shadow-lg">
        {/* Neon glow effect */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary opacity-5 rounded-full blur-3xl pointer-events-none transition-opacity group-hover:opacity-10"></div>
        
        {/* Glow icon */}
        <div className="w-20 h-20 rounded-xl bg-surface border border-outline-variant flex items-center justify-center mb-lg relative overflow-hidden shadow-inner">
          <span className="material-symbols-outlined text-[42px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            all_inclusive
          </span>
        </div>

        <h1 className="font-h1 text-h1 text-on-surface text-center mb-xs">StudySync</h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center mb-xl max-w-[280px]">
          An elegant, high-focus dashboard for your academic schedule & tasks.
        </p>

        <div className="flex flex-col gap-sm w-full">
          <button
            onClick={handleSignIn}
            className="w-full bg-[#507DBC] text-white hover:bg-[#436ca3] font-label-md text-label-md py-md rounded-lg flex items-center justify-center gap-sm transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            {/* Custom SVG Google Icon */}
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M21.35,11.1H12v2.7h5.38C17.1,14.9,15.75,16.5,13.9,17.2v2.3h3.58C19.5,17.5,21,14.6,21,11.1z M12,21.3c2.4,0,4.4-0.8,5.8-2.2l-3.58-2.3c-1,0.6-2.2,1-3.6,1c-2.8,0-5.1-1.9-6-4.5H1.1v2.4C2.8,18.9,7.1,21.3,12,21.3z M6,13.3c-0.2-0.6-0.3-1.2-0.3-1.8c0-0.6,0.1-1.2,0.3-1.8V7.3H1.1C0.4,8.7,0,10.3,0,12c0,1.7,0.4,3.3,1.1,4.7L6,13.3z M12,6.7c1.3,0,2.5,0.5,3.4,1.3l2.6-2.6C16.4,4,14.4,3.3,12,3.3C7.1,3.3,2.8,5.7,1.1,8.9L6,11.3C6.9,8.7,9.2,6.7,12,6.7z" />
            </svg>
            Sign In with Google
          </button>
          
          <button
            onClick={handleGuestLogin}
            className="w-full bg-surface-variant text-on-surface hover:bg-surface-bright border border-outline-variant font-label-md text-label-md py-md rounded-lg flex items-center justify-center gap-sm transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[20px]">person_play</span>
            Sign In as Guest
          </button>
        </div>
        
        <div className="mt-xl pt-md border-t border-outline-variant/30 w-full flex items-center justify-center gap-xs">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            install_mobile
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            Installable Progressive Web App
          </span>
        </div>
      </div>
    </main>
  );
}
