"use client";

import { useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import ReverseCalendar from "@/components/ReverseCalendar";
import { useUser } from "@/components/UserContext"; // agar page.tsx ke same folder me hai, nahi toh "@/components/UserContext"

export default function DashboardPage() {
  const userContext = useUser() as any;
  const currentUser = userContext?.currentUser || userContext?.user;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form Submit Handler
  const handleUserEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSubmitting(true);
    const formattedUser = {
      id: email.toLowerCase().trim(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
    };

    // UserContext ke alag-alag function names ko check karke call karega
    if (typeof userContext?.setCurrentUser === "function") {
      userContext.setCurrentUser(formattedUser);
    } else if (typeof userContext?.setUser === "function") {
      userContext.setUser(formattedUser);
    } else if (typeof userContext?.login === "function") {
      userContext.login(formattedUser);
    }

    localStorage.setItem("gate_current_user", JSON.stringify(formattedUser));
    setSubmitting(false);
    window.location.reload(); // State instant sync karne ke liye
  };

  // Sign out Handler
  const handleSignOut = () => {
    if (typeof userContext?.logout === "function") {
      userContext.logout();
    } else if (typeof userContext?.signOut === "function") {
      userContext.signOut();
    } else if (typeof userContext?.setCurrentUser === "function") {
      userContext.setCurrentUser(null);
    }

    localStorage.removeItem("gate_current_user");
    localStorage.removeItem("user");
    window.location.reload();
  };

  // 1. Agar User Login NAHI hai toh Entry Form dikhega
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md p-8 space-y-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">GATE 2027 Dashboard</h1>
            <p className="text-sm text-slate-400">Continue karne ke liye apni details enter karein</p>
          </div>

          <form onSubmit={handleUserEntry} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Aapka Naam
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Apna poora naam daalein"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email ID
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow transition duration-150 cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Opening..." : "Enter Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Agar User Enter ho chuka hai toh Dashboard Render hoga
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-4">
      <div className="flex justify-end max-w-7xl mx-auto">
        <button
          onClick={handleSignOut}
          className="px-3.5 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-500/20 text-xs font-semibold rounded-lg transition cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      <div className="max-w-7xl mx-auto space-y-4">
        <DashboardHeader />
        <ReverseCalendar />
      </div>
    </div>
  );
}