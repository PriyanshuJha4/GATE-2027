"use client";

import { useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import ReverseCalendar from "@/components/ReverseCalendar";
import { useUser, SUPER_ADMIN_EMAIL } from "@/components/UserContext";

export default function DashboardPage() {
  const { currentUser, loginOrRegister, forgotPassword, signOut } = useUser() as any;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot Password View State
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  // Form Submit Handler (Login / Register with Password)
  const handleUserEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setSubmitting(true);
    setErrorMsg(null);

    const res = await loginOrRegister(name.trim(), email.trim(), password);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Authentication failed. Kripya dobara koshish karein.");
    }
  };

  // Forgot Password Handler
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setSubmitting(true);
    const res = await forgotPassword(forgotEmail.trim());
    setSubmitting(false);

    if (res.success) {
      alert("Password reset link aapke email par bhej diya gaya hai!");
      setIsForgotMode(false);
      setForgotEmail("");
    } else {
      alert("Error: " + res.error);
    }
  };

  // 1. Agar User Login NAHI hai toh Entry / Password Setup Form dikhega
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md p-8 space-y-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">GATE 2027 Dashboard</h1>
            <p className="text-sm text-slate-400">
              {isForgotMode ? "Password Reset Karein" : "Continue karne ke liye apni details aur password enter karein"}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-red-950/50 border border-red-500/50 text-red-300">
              {errorMsg}
            </div>
          )}

          {!isForgotMode ? (
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
                {email.trim().toLowerCase() === SUPER_ADMIN_EMAIL && (
                  <p className="text-[11px] text-amber-400 mt-1 font-semibold">
                    ⭐ Admin Email detected! Full control unlocked.
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Password (Setup / Login)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotMode(true)}
                    className="text-xs text-indigo-400 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow transition duration-150 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Authenticating..." : "Enter Dashboard"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Registered Email ID
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsForgotMode(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition cursor-pointer"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 2. Agar User Enter ho chuka hai toh Dashboard Render hoga
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-4">
      <div className="flex justify-end max-w-7xl mx-auto">
        <button
          onClick={() => signOut()}
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