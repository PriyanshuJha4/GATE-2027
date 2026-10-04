"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "./UserContext";
import Sidebar from "./Sidebar";
import ImpersonationBanner from "./ImpersonationBanner";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useUser();
  const pathname = usePathname() || "";

  // /offline and /sync must open WITHOUT the profile login: the phone reads its own stored copy even with no internet
  // (the login screen needs Supabase). /sync protects itself with the sync passphrase, /offline only shows this phone's own data.
  if (pathname === "/offline" || pathname.startsWith("/offline/") || pathname === "/sync" || pathname.startsWith("/sync/")) {
    return (
      <>
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
          <span className="font-extrabold text-gray-800 text-base">GATE 2027</span>
          <nav className="flex gap-2 text-xs font-semibold">
            <a href="/offline" className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700">Offline library</a>
            <a href="/sync" className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700">Cloud sync</a>
            <a href="/" className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700">Dashboard</a>
          </nav>
        </header>
        <main className="w-full min-h-screen px-4 py-5 sm:px-6 md:px-8 max-w-3xl mx-auto">{children}</main>
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white text-sm">
        Loading GATE 2027 Dashboard...
      </div>
    );
  }

  // Agar user logged in nahi hai, toh sirf login form dikhega (No Header / Sidebar)
  if (!currentUser) {
    return (
      <main className="w-full min-h-screen flex items-center justify-center bg-slate-950 p-4">
        {children}
      </main>
    );
  }

  // Logged in hone ke baad pura dashboard navigation ke sath dikhega
  return (
    <>
      <ImpersonationBanner />
      <Sidebar />
      <main className="w-full min-h-screen px-4 py-5 sm:px-6 md:px-8 max-w-5xl mx-auto">
        {children}
      </main>
    </>
  );
}