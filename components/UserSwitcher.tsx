"use client";

import { useState } from "react";
import { useUser, SUPER_ADMIN_EMAIL } from "./UserContext";

export default function UserSwitcher() {
  const { currentUser, users, selectUser, loginOrRegister, forgotPassword, isAdmin } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setSubmitting(true);
    setMessage(null);
    const res = await loginOrRegister(name.trim(), email.trim(), password);
    setSubmitting(false);

    if (res.success) {
      setName("");
      setEmail("");
      setPassword("");
      setShowAuthModal(false);
    } else {
      setMessage({ type: "error", text: res.error || "Authentication failed" });
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setSubmitting(true);
    const res = await forgotPassword(forgotEmail.trim());
    setSubmitting(false);

    if (res.success) {
      alert("Password reset link sent to your email!");
      setShowForgotModal(false);
      setForgotEmail("");
    } else {
      alert("Error: " + res.error);
    }
  };

  // 1. Logged In View
  if (currentUser) {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Account
            </span>
            {isAdmin ? (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                👑 ADMIN
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                Student
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 truncate">{currentUser.name}</p>
            <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
          </div>
        </div>

        {/* ADMIN EXCLUSIVE: Switch to any user without logging out */}
        {isAdmin && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900">
                Switch Aspirant View:
              </span>
              <button
                onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
                className="text-[10px] text-indigo-600 hover:underline font-semibold cursor-pointer"
              >
                {showSwitchDropdown ? "Close" : "Change User ▾"}
              </button>
            </div>

            {showSwitchDropdown && (
              <div className="p-2 border border-amber-200 bg-amber-50/50 rounded-xl space-y-1 max-h-48 overflow-y-auto">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      selectUser(u);
                      setShowSwitchDropdown(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      currentUser.id === u.id
                        ? "bg-amber-600 text-white font-bold"
                        : "hover:bg-white text-slate-700"
                    }`}
                  >
                    <span className="truncate">{u.name}</span>
                    <span className="text-[10px] opacity-75">
                      {u.role === "admin" ? "Admin" : "Student"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. Logged Out View
  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowAuthModal(true)}
        className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
      >
        🔑 Sign In / Register
      </button>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Welcome Aspirant</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter your details & set up your password to track GATE progress.
              </p>
            </div>

            {message && (
              <div className="p-2 text-xs rounded bg-red-50 text-red-600 border border-red-200">
                {message.text}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prem Jha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-lg focus:outline-indigo-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-lg focus:outline-indigo-600"
                />
                {email.trim().toLowerCase() === SUPER_ADMIN_EMAIL && (
                  <p className="text-[11px] text-amber-600 mt-1 font-semibold">
                    ⭐ Admin Email detected! Full control will be unlocked.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Password (Setup / Login)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-lg focus:outline-indigo-600"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthModal(false);
                    setShowForgotModal(true);
                  }}
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Forgot Password?
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Processing..." : "Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Reset Password</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter your registered email to receive a password reset link.
              </p>
            </div>

            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-lg focus:outline-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}