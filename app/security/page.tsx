"use client";

import UserSecuritySettings from "@/components/UserSecuritySettings";
import { useUser } from "@/components/UserContext";
import { useRouter } from "next/navigation";

export default function SecurityPage() {
  const { currentUser } = useUser() as any;
  const router = useRouter();

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Kripya pehle login karein.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold text-white">Account Security Settings</h1>
        <button
          onClick={() => router.push("/")}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg transition"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="flex justify-center pt-4">
        <UserSecuritySettings />
      </div>
    </div>
  );
}