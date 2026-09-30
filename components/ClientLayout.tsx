"use client";

import { ReactNode } from "react";
import { useUser } from "./UserContext";
import Sidebar from "./Sidebar";
import ImpersonationBanner from "./ImpersonationBanner";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useUser();

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