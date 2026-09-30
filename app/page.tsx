"use client";

import { useState } from "react";
import DashboardHeader from "../components/DashboardHeader";
import ReverseCalendar from "../components/ReverseCalendar";
import { useUser, SUPER_ADMIN_EMAIL } from "../components/UserContext";

const SECURITY_QUESTIONS_LIST = [
  "Aapke pehle school ka naam kya hai?",
  "Aapke favourite teacher ka naam kya hai?",
  "Aapke bachpan ke best friend ka naam kya hai?",
  "Aapke favourite pet (paaltu janwar) ka naam kya hai?",
  "Aap kis sheher mein paida hue the?"
];

export default function DashboardPage() {
  const { currentUser, loginOrRegister, forgotPassword, resetPasswordWithSecurity, signOut } = useUser() as any;

  const [authRole, setAuthRole] = useState<"student" | "admin">("student");
  
  // Student ke andar mode: "login" ya "register"
  const [studentMode, setStudentMode] = useState<"login" | "register">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS_LIST[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot Password States
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [fetchedQuestion, setFetchedQuestion] = useState<string | null>(null);
  const [fetchingQuestion, setFetchingQuestion] = useState(false);
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleUserEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    if (authRole === "student" && studentMode === "register") {
      if (!name.trim() || !securityQuestion || !securityAnswer.trim()) {
        setErrorMsg("Naye user ke liye naam, security question aur answer bharna zaroori hai.");
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg(null);

    const targetEmail = email.trim().toLowerCase();

    const res = await loginOrRegister(
      studentMode === "register" ? name.trim() : "Student",
      targetEmail,
      password,
      studentMode === "register" ? securityQuestion : undefined,
      studentMode === "register" ? securityAnswer : undefined
    );
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Authentication failed. Kripya dobara koshish karein.");
    }
  };

  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    const targetEmail = forgotEmail.trim().toLowerCase();

    if (authRole === "admin" || targetEmail === SUPER_ADMIN_EMAIL) {
      setSubmitting(true);
      const res = await forgotPassword(targetEmail);
      setSubmitting(false);
      if (res.success) {
        alert("Password reset link admin email par bhej diya gaya hai!");
        setIsForgotMode(false);
        setForgotEmail("");
      } else {
        setErrorMsg("Error: " + res.error);
      }
      return;
    }

    setFetchingQuestion(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/reset-password?email=${encodeURIComponent(targetEmail)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setFetchedQuestion(data.securityQuestion);
      } else {
        setErrorMsg(data.error || "Yeh email registered nahi hai.");
      }
    } catch (err: any) {
      setErrorMsg("Kuch garbar ho gayi. Dobara koshish karein.");
    } finally {
      setFetchingQuestion(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotAnswer.trim() || !newPassword) {
      setErrorMsg("Security answer aur naya password enter karna zaroori hai.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const res = await resetPasswordWithSecurity(forgotEmail.trim(), forgotAnswer.trim(), newPassword);
    setSubmitting(false);

    if (res.success) {
      alert("Password successfully reset ho gaya! Ab aap login kar sakte hain.");
      setIsForgotMode(false);
      setForgotEmail("");
      setFetchedQuestion(null);
      setForgotAnswer("");
      setNewPassword("");
    } else {
      setErrorMsg(res.error || "Password reset fail ho gaya.");
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100 py-8">
        <div className="w-full max-w-md p-8 space-y-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">GATE 2027 Dashboard</h1>
            <p className="text-sm text-slate-400">
              {isForgotMode ? "Password Recovery Portal" : "Apni role select karke login ya register karein"}
            </p>
          </div>

          {/* Main Role Switcher */}
          {!isForgotMode && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAuthRole("student");
                  setErrorMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  authRole === "student" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                🎓 Student Portal
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthRole("admin");
                  setEmail(SUPER_ADMIN_EMAIL);
                  setErrorMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  authRole === "admin" ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                👑 Admin Portal
              </button>
            </div>
          )}

          {/* Student Sub-Mode Switcher (Login vs New User Register) */}
          {!isForgotMode && authRole === "student" && (
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => { setStudentMode("login"); setErrorMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  studentMode === "login" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Existing Login
              </button>
              <button
                type="button"
                onClick={() => { setStudentMode("register"); setErrorMsg(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  studentMode === "register" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                ✨ New User Register
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-red-950/50 border border-red-500/50 text-red-300">
              {errorMsg}
            </div>
          )}

          {!isForgotMode ? (
            <form onSubmit={handleUserEntry} className="space-y-4">
              {/* Name field only for New User or Admin */}
              {(authRole === "admin" || studentMode === "register") && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Aapka Naam
                  </label>
                  <input
                    type="text"
                    required={studentMode === "register"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Apna poora naam daalein"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

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

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setFetchedQuestion(null);
                      setErrorMsg(null);
                    }}
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

              {/* Security Questions visible ONLY for New User Registration */}
              {authRole === "student" && studentMode === "register" && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <p className="text-[11px] text-emerald-400 font-medium">
                    🔒 Security Question (Password recovery ke liye zaroori hai)
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Security Question Select Karein
                    </label>
                    <select
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {SECURITY_QUESTIONS_LIST.map((q, idx) => (
                        <option key={idx} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Security Answer (Custom)
                    </label>
                    <input
                      type="text"
                      required
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      placeholder="Apna jawab yahan likhein..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-2.5 px-4 text-white font-medium text-sm rounded-xl shadow transition duration-150 cursor-pointer disabled:opacity-50 mt-2 ${
                  authRole === "admin"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : studentMode === "register"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {submitting
                  ? "Processing..."
                  : authRole === "admin"
                  ? "Enter Admin Dashboard"
                  : studentMode === "register"
                  ? "Register & Enter Dashboard"
                  : "Login to Dashboard"}
              </button>
            </form>
          ) : (
            /* Forgot Password Flow */
            <div>
              {!fetchedQuestion ? (
                <form onSubmit={handleFetchQuestion} className="space-y-4">
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

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(false);
                        setErrorMsg(null);
                      }}
                      className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={fetchingQuestion || submitting}
                      className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow transition cursor-pointer disabled:opacity-50"
                    >
                      {fetchingQuestion ? "Checking..." : "Next"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-indigo-300">
                    <span className="font-bold block text-slate-400 mb-1">Aapka Security Question:</span>
                    {fetchedQuestion}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Security Answer Enter Karein
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      placeholder="Aapka jawab..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Naya Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFetchedQuestion(null);
                        setErrorMsg(null);
                      }}
                      className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow transition cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? "Updating..." : "Reset Password"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

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