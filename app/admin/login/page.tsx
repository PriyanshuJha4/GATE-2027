"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  // 1. Password Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
      setLoading(false);
    } else {
      setMessage({ type: "success", text: "Login successful! Redirecting..." });
      router.push("/admin/dashboard");
    }
  };

  // 2. Email OTP / Magic Link Login
  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: "error", text: "Kripya email enter karein." });
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/admin/dashboard`,
      },
    });

    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setMessage({
        type: "success",
        text: "Login link / OTP aapke email par bhej diya gaya hai. Apna inbox check karein.",
      });
    }
    setLoading(false);
  };

  // 3. Forgot Password Link
  const handleForgotPassword = async () => {
    if (!email) {
      setMessage({ type: "error", text: "Reset link paane ke liye pehle apna email fill karein." });
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });

    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setMessage({
        type: "success",
        text: "Password reset link aapke email par bhej diya gaya hai!",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Admin Authentication</h1>
          <p className="text-sm text-slate-400">GATE Dashboard Control Panel</p>
        </div>

        {/* Tab Switcher: Password vs OTP */}
        <div className="flex border border-slate-800 rounded-lg p-1 bg-slate-950">
          <button
            type="button"
            onClick={() => { setAuthMode("password"); setMessage(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
              authMode === "password"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Password Login
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("otp"); setMessage(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
              authMode === "otp"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Email OTP / Magic Link
          </button>
        </div>

        {message && (
          <div
            className={`p-3 text-sm rounded-lg border ${
              message.type === "success"
                ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-300"
                : "bg-red-950/50 border-red-500/50 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {authMode === "password" ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition"
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
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg shadow transition duration-150 cursor-pointer"
            >
              {loading ? "Authenticating..." : "Login with Password"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg shadow transition duration-150 cursor-pointer"
            >
              {loading ? "Sending..." : "Send Magic Link / OTP"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}