"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/components/UserContext";

export default function UserSecuritySettings() {
  const { currentUser, refreshUsers } = useUser() as any;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(
    currentUser?.security_question || "Aapke favourite teacher ka naam kya hai?"
  );
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!currentUser) {
      setMsg({ type: "error", text: "Koi user logged-in nahi hai." });
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setMsg({ type: "error", text: "Password kam se kam 6 characters ka hona chahiye." });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setMsg({ type: "error", text: "Passwords match nahi kar rahe hain." });
      return;
    }

    setLoading(true);

    try {
      // 1. अगर नया पासवर्ड दिया है तो Supabase Auth में अपडेट करें
      if (newPassword) {
        const { error: authErr } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (authErr) throw new Error(authErr.message);
      }

      // 2. डेटाबेस में कस्टम सिक्योरिटी क्वेश्चन और आंसर अपडेट करें
      const updateData: any = {};
      if (securityQuestion) updateData.security_question = securityQuestion.trim();
      if (securityAnswer) updateData.security_answer = securityAnswer.trim().toLowerCase();

      const { error: dbErr } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", currentUser.id);

      if (dbErr) throw new Error(dbErr.message);

      await refreshUsers();
      setMsg({ type: "success", text: "Security settings aur password safalta se update ho gaye!" });
      setNewPassword("");
      setConfirmPassword("");
      setSecurityAnswer("");
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Update karne mein samasya aayi." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-lg text-slate-100">
      <h2 className="text-lg font-bold text-white mb-1">Security & Password Settings</h2>
      <p className="text-xs text-slate-400 mb-4">Apna custom security question, answer ya password badlein</p>

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

      <form onSubmit={handleUpdateSecurity} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Security Question (Aap apna custom question bhi likh sakte hain)
          </label>
          <input
            type="text"
            value={securityQuestion}
            onChange={(e) => setSecurityQuestion(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            New Security Answer
          </label>
          <input
            type="text"
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            placeholder="Naya answer likhein"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Agar answer nahi badalna, toh ise khali chhor dein.
          </p>
        </div>

        <hr className="border-slate-800 my-2" />

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            New Password (Optional)
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Naya password (min 6 characters)"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Password dobara likhein"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Saving Changes..." : "Save Security Changes"}
        </button>
      </form>
    </div>
  );
}