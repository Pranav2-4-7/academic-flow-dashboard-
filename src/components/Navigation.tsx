"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface NavigationProps {
  activeTab: "home" | "calendar" | "settings" | "attendance";
  children: React.ReactNode;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, children }) => {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background font-body-lg text-on-background">
      {/* Desktop SideNavBar */}
      <nav className="hidden md:flex flex-col h-full py-lg px-md gap-base bg-surface-container w-[240px] left-0 top-0 border-r border-outline-variant transition-all duration-200 ease-in-out shrink-0 z-20 relative">
        {/* Header Profile */}
        <div className="flex items-center gap-sm mb-xl px-xs">
          <img
            alt={user?.displayName || "User avatar"}
            className="w-10 h-10 rounded-full object-cover border border-outline-variant"
            src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuD_LVrI0K7dGYyqxKijSWR--Fc4hHxKiz9GITNqnmRMhNxN4TB-joD4v1VffKAPSAtVoh2347ItDeJ8OAOeB2a8jdnnpb8H2rxrPlTA6dkUgXIzVMDRmDnGMO35BXFfTUcpbYqwTAgqCC8rnrHXbb_WGecDV-i5VY2BoVIPLDEnMLgCJBMaLkIBMc3ab0Yt4ZRWP5Qu_NyXMdYYAwsCp2Wnpr_15e0rHLiULwV1FaQkxlYJ7MUaVLI1"}
          />
          <div className="flex flex-col overflow-hidden">
            <span className="font-h3 text-h3 text-on-surface font-bold truncate">
              {user?.displayName || "Guest User"}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
              {user?.email || "Student"}
            </span>
          </div>
        </div>

        {/* Main Nav Links */}
        <div className="flex flex-col gap-base flex-1">
          <Link
            href="/dashboard"
            className={`flex items-center gap-sm px-sm py-xs rounded hover:bg-surface-bright transition-colors group ${
              activeTab === "home"
                ? "text-primary border-r-2 border-primary"
                : "text-on-surface-variant"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                activeTab === "home" ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface"
              }`}
              style={activeTab === "home" ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              home
            </span>
            <span className="font-label-md text-label-md group-hover:text-on-surface">Home</span>
          </Link>

          <Link
            href="/calendar"
            className={`flex items-center gap-sm px-sm py-xs rounded hover:bg-surface-bright transition-colors group ${
              activeTab === "calendar"
                ? "text-primary border-r-2 border-primary"
                : "text-on-surface-variant"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                activeTab === "calendar" ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface"
              }`}
              style={activeTab === "calendar" ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              calendar_today
            </span>
            <span className="font-label-md text-label-md group-hover:text-on-surface">Calendar</span>
          </Link>

          <Link
            href="/attendance-calculator"
            className={`flex items-center gap-sm px-sm py-xs rounded hover:bg-surface-bright transition-colors group ${
              activeTab === "attendance"
                ? "text-primary border-r-2 border-primary"
                : "text-on-surface-variant"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                activeTab === "attendance" ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface"
              }`}
              style={activeTab === "attendance" ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              percent
            </span>
            <span className="font-label-md text-label-md group-hover:text-on-surface">Attendance</span>
          </Link>

          <Link
            href="/settings"
            className={`flex items-center gap-sm px-sm py-xs rounded hover:bg-surface-bright transition-colors group ${
              activeTab === "settings"
                ? "text-primary border-r-2 border-primary"
                : "text-on-surface-variant"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                activeTab === "settings" ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface"
              }`}
              style={activeTab === "settings" ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              settings
            </span>
            <span className="font-label-md text-label-md group-hover:text-on-surface">Settings</span>
          </Link>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-base mt-auto">
          <button className="w-full py-sm px-md rounded bg-surface-variant hover:bg-surface-bright border border-outline-variant text-on-surface font-label-md text-label-md transition-colors mb-sm cursor-pointer">
            Upgrade Pro
          </button>
          <a
            href="#"
            className="flex items-center gap-sm px-sm py-xs rounded hover:bg-surface-bright transition-colors text-on-surface-variant group"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-on-surface">
              help
            </span>
            <span className="font-label-md text-label-md group-hover:text-on-surface">Help</span>
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-sm px-sm py-xs rounded hover:bg-surface-bright transition-colors text-on-surface-variant group w-full text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-on-surface">
              logout
            </span>
            <span className="font-label-md text-label-md group-hover:text-on-surface">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto pb-[80px] md:pb-0">{children}</div>

        {/* Mobile BottomNavBar */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 bg-surface z-50 h-16 border-t border-outline-variant">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center justify-center p-2 rounded flex-1 h-full active:bg-surface-container-high transition-transform active:scale-95 ${
              activeTab === "home" ? "text-primary font-bold" : "text-on-surface-variant"
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={activeTab === "home" ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              home
            </span>
            <span className="text-[11px] font-semibold mt-1">Home</span>
          </Link>

          <Link
            href="/calendar"
            className={`flex flex-col items-center justify-center p-2 rounded flex-1 h-full active:bg-surface-container-high transition-transform active:scale-95 ${
              activeTab === "calendar" ? "text-primary font-bold" : "text-on-surface-variant"
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={activeTab === "calendar" ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              calendar_month
            </span>
            <span className="text-[11px] font-semibold mt-1">Calendar</span>
          </Link>

          <Link
            href="/attendance-calculator"
            className={`flex flex-col items-center justify-center p-2 rounded flex-1 h-full active:bg-surface-container-high transition-transform active:scale-95 ${
              activeTab === "attendance" ? "text-primary font-bold" : "text-on-surface-variant"
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={activeTab === "attendance" ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              percent
            </span>
            <span className="text-[11px] font-semibold mt-1">Attendance</span>
          </Link>

          <Link
            href="/settings"
            className={`flex flex-col items-center justify-center p-2 rounded flex-1 h-full active:bg-surface-container-high transition-transform active:scale-95 ${
              activeTab === "settings" ? "text-primary font-bold" : "text-on-surface-variant"
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={activeTab === "settings" ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              settings
            </span>
            <span className="text-[11px] font-semibold mt-1">Settings</span>
          </Link>
        </nav>
      </div>
    </div>
  );
};
