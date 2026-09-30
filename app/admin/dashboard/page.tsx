"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminPasswordSettings from "@/components/AdminPasswordSettings";

interface LibraryItem {
  id: string;
  title: string;
  file_url: string;
  file_type?: string;
  subject?: string;
  visibility: "private" | "global";
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [fetchingItems, setFetchingItems] = useState(false);

  // 1. Auth Guard & Check Admin Session
  useEffect(() => {
    const checkAdminAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin/login");
        return;
      }

      setAdminEmail(session.user.email || null);
      setLoading(false);
      fetchLibraryItems();
    };

    checkAdminAuth();
  }, [router]);

  // 2. Fetch Library Items
  const fetchLibraryItems = async () => {
    setFetchingItems(true);
    const { data, error } = await supabase
      .from("library_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data as LibraryItem[]);
    }
    setFetchingItems(false);
  };

  // 3. Toggle Visibility (Private <-> Global)
  const toggleVisibility = async (id: string, currentVisibility: string) => {
    const nextVisibility = currentVisibility === "private" ? "global" : "private";

    const { error } = await supabase
      .from("library_items")
      .update({ visibility: nextVisibility })
      .eq("id", id);

    if (error) {
      alert("Visibility update failed: " + error.message);
    } else {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, visibility: nextVisibility as "private" | "global" } : item
        )
      );
    }
  };

  // 4. Admin Sign Out
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Verifying admin session...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Control Center</h1>
          <p className="text-xs text-slate-400 mt-1">Logged in as: {adminEmail}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg transition"
          >
            View Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-medium rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Password Management */}
        <div className="lg:col-span-1">
          <AdminPasswordSettings />
        </div>

        {/* Right Column: Library Items Visibility Manager */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Library Items Visibility</h2>
              <p className="text-xs text-slate-400">Files ko Public (Global) ya Admin-Only (Private) banayein</p>
            </div>
            <button
              onClick={fetchLibraryItems}
              disabled={fetchingItems}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              {fetchingItems ? "Refreshing..." : "Refresh List"}
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Koi library items nahi mile. Supabase mein `library_items` check karein.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Current Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 font-medium text-white">{item.title}</td>
                      <td className="py-3 px-3 text-slate-400">{item.subject || "General"}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            item.visibility === "global"
                              ? "bg-emerald-950/70 border border-emerald-500/40 text-emerald-300"
                              : "bg-amber-950/70 border border-amber-500/40 text-amber-300"
                          }`}
                        >
                          {item.visibility === "global" ? "Global (Public)" : "Private (Admin)"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => toggleVisibility(item.id, item.visibility)}
                          className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                            item.visibility === "global"
                              ? "bg-slate-800 hover:bg-slate-700 text-amber-300"
                              : "bg-indigo-600 hover:bg-indigo-500 text-white"
                          }`}
                        >
                          Make {item.visibility === "global" ? "Private" : "Global"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}