"use client";

import { useState } from "react";
import { updateAdminPassword, removeAdminPassword } from "@/lib/authActions";

export default function AdminPasswordSettings() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Password Create ya Edit/Update karna
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (password.length < 6) {
      setMsg({ type: "error", text: "Password kam se kam 6 characters ka hona chahiye." });
      return;
    }
    if (password !== confirmPassword) {
      setMsg({ type: "error", text: "Passwords match nahi kar rahe hain." });
      return;
    }

    setLoading(true);
    try {
      await updateAdminPassword(password);
      setMsg({ type: "success", text: "Password safalta se set/update ho gaya!" });
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to update password" });
    } finally {
      setLoading(false);
    }
  };

  // 2. Password Delete/Remove karna (Wapas Email OTP mode par aana)
  const handleRemovePassword = async () => {
    const confirmDelete = window.confirm(
      "Kya aap sach me password delete karna chahte hain? Iske baad aap sirf Email OTP/Magic Link se login kar sakenge."
    );
    if (!confirmDelete) return;

    setLoading(true);
    setMsg(null);
    try {
      await removeAdminPassword();
      setMsg({ type: "success", text: "Password remove ho gaya. Ab login sirf OTP se hoga." });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to remove password" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-lg text-slate-100">
      <h2 className="text-lg font-bold text-white mb-1">Admin Security Settings</h2>
      <p className="text-xs text-slate-400 mb-4">Set, update ya remove karein apna login password</p>

      {msg && (
        <div
          className={`p-3 mb-4 text-xs rounded-lg border ${
            msg.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-300"
              : "bg-red-950/50 border-red-500/50 text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSavePassword} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Naya Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Naya password daalein"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Password dobara likhein"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div className="flex gap-2 pt-2">
          {/* Create / Edit Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save / Edit Password"}
          </button>

          {/* Delete Password Button */}
          <button
            type="button"
            onClick={handleRemovePassword}
            disabled={loading}
            className="py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-lg transition disabled:opacity-50"
          >
            Delete Password
          </button>
        </div>
      </form>
    </div>
  );
}