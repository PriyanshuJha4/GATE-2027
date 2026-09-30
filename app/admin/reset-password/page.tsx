"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AdminResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setIsReady(true);
      }
    });

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession();
          if (!retryData.session) {
            setErrorMsg("Recovery link invalid ya expired ho chuka hai.");
          } else {
            setIsReady(true);
          }
        }, 1000);
      } else {
        setIsReady(true);
      }
    };

    checkSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    if (password.length < 6) {
      setErrorMsg("Password kam se kam 6 characters ka hona chahiye.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
    } else {
      // पासवर्ड अपडेट होने के बाद तुरंत साइन-आउट कर दें ताकि यूजर सीधे कंट्रोल पैनल में न घुसे, बल्कि लॉगिन करे
      await supabase.auth.signOut();
      setLoading(false);
      
      alert("Password successfully update ho gaya! Ab naye password se login karein.");
      router.push("/admin/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100 py-8">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Set New Password</h1>
          <p className="text-sm text-slate-400">Apna naya password enter karein</p>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs rounded-xl bg-red-950/50 border border-red-500/50 text-red-300">
            {errorMsg}
          </div>
        )}

        {!isReady && !errorMsg ? (
          <div className="text-center py-6 text-xs text-slate-400 animate-pulse">
            Recovery link verify ho raha hai...
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !isReady}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm rounded-xl shadow transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}