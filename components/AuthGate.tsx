"use client";

import { useState } from "react";
import { useUser } from "@/components/UserContext";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { currentUser, users, loading, addUser, selectUser } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm text-slate-400">Loading GATE 2027 Dashboard...</p>
        </div>
      </div>
    );
  }

  // Agar user logged-in hai toh dashboard show karein
  if (currentUser) {
    return <>{children}</>;
  }

  // New user create karne ka logic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || !email.trim()) {
      setErrorMsg("Please fill out both Name and Email.");
      return;
    }

    setIsSubmitting(true);
    const result = await addUser(name, email);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMsg(result.error || "Failed to setup user. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-6 md:p-8 shadow-2xl backdrop-blur-md">
        
        {/* Header Icon & Title */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            GATE 2027 Dashboard
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Select an existing profile or register a new one to continue.
          </p>
        </div>

        {/* Existing Users List Section */}
        {users.length > 0 && (
          <div className="mb-6">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Existing Profiles ({users.length})
            </p>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:border-indigo-500/50 hover:bg-slate-800/60 group"
                >
                  <div className="overflow-hidden pr-2">
                    <p className="truncate text-sm font-medium text-slate-200 group-hover:text-indigo-400 transition-colors">
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {u.email}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500 group-hover:text-indigo-400">
                    &rarr;
                  </span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="w-full border-t border-slate-800"></div>
              <span className="absolute bg-slate-900 px-3 text-[11px] font-medium uppercase text-slate-500">
                Or create new
              </span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
            {errorMsg}
          </div>
        )}

        {/* Create Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? "Setting up..." : "Get Started"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Your session stays saved on this device until you sign out.
        </p>
      </div>
    </div>
  );
}