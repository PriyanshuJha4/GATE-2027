"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, SUPER_ADMIN_EMAIL } from "@/components/UserContext";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface UserProgressSummary {
  userId: string;
  name: string;
  email: string;
  role: string;
  completedTopicsCount: number;
  lastActive: string | null;
}

export default function AdminPage() {
  const { currentUser, isAdmin, users, promoteToAdmin, deleteUser, refreshUsers } = useUser();
  const [summaries, setSummaries] = useState<UserProgressSummary[]>([]);
  const [totalTopicsCount, setTotalTopicsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // New Admin Form
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);

    // 1. Get total topics
    const { count } = await supabase
      .from("syllabus_topics")
      .select("*", { count: "exact", head: true });
    setTotalTopicsCount(count || 0);

    // 2. Get progress of all users
    const { data: progressData } = await supabase
      .from("syllabus_progress")
      .select("user_id, completed, updated_at")
      .eq("completed", true);

    const latestUsers = await refreshUsers();

    const stats: UserProgressSummary[] = latestUsers.map((u) => {
      const userProgress = progressData?.filter((p) => p.user_id === u.id) || [];
      const latestUpdate = userProgress.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role || "student",
        completedTopicsCount: userProgress.length,
        lastActive: latestUpdate?.updated_at || null,
      };
    });

    setSummaries(stats);
    setLoading(false);
  }, [refreshUsers]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin, fetchAdminData]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-rose-600">Access Denied (403)</h2>
        <p className="text-sm text-slate-500">
          Only administrators can access this dashboard.
        </p>
        <Link href="/" className="inline-block text-xs font-semibold text-indigo-600 underline">
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  const handleAddDirectAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminName.trim()) return;

    setAddingAdmin(true);
    const { error } = await supabase.from("users").upsert(
      {
        name: newAdminName.trim(),
        email: newAdminEmail.trim().toLowerCase(),
        role: "admin",
      },
      { onConflict: "email" }
    );
    setAddingAdmin(false);

    if (error) {
      alert("Error adding admin: " + error.message);
    } else {
      setNewAdminName("");
      setNewAdminEmail("");
      fetchAdminData();
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">👑</span>
              <h1 className="text-2xl font-bold text-slate-800">
                Super Admin Control Center
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Logged in as <span className="font-bold text-amber-900">{currentUser?.email}</span>. Manage users, delegate admin privileges, and track student preparation.
            </p>
          </div>
          <button
            onClick={fetchAdminData}
            className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs"
          >
            🔄 Refresh Stats
          </button>
        </div>
      </div>

      {/* Add New Admin Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-800">
          + Add New Admin by Email
        </h3>
        <p className="text-xs text-slate-500">
          Grant full administrative powers to another team member or teacher.
        </p>
        <form onSubmit={handleAddDirectAdmin} className="flex flex-col sm:flex-row gap-3 pt-1">
          <input
            type="text"
            required
            placeholder="Admin Full Name"
            value={newAdminName}
            onChange={(e) => setNewAdminName(e.target.value)}
            className="text-xs px-3 py-2 border rounded-lg flex-1 focus:outline-amber-600"
          />
          <input
            type="email"
            required
            placeholder="admin.email@example.com"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            className="text-xs px-3 py-2 border rounded-lg flex-1 focus:outline-amber-600"
          />
          <button
            type="submit"
            disabled={addingAdmin}
            className="px-4 py-2 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-xs disabled:opacity-50"
          >
            {addingAdmin ? "Adding..." : "Grant Admin Access"}
          </button>
        </form>
      </div>

      {/* Users & Progress Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Registered Users & Preparation Audit ({summaries.length})
          </h2>
          <span className="text-xs text-slate-400">Total Topics: {totalTopicsCount}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Syllabus Completion</th>
                <th className="p-3.5">Last Activity</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {summaries.map((u) => {
                const percent =
                  totalTopicsCount > 0
                    ? Math.round((u.completedTopicsCount / totalTopicsCount) * 100)
                    : 0;
                const isSuper = u.email === SUPER_ADMIN_EMAIL;

                return (
                  <tr key={u.userId} className="hover:bg-slate-50/50">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="p-3.5">
                      {u.role === "admin" ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          {isSuper ? "Super Admin" : "Admin"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-600">
                          Student
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-800">{percent}%</span>
                        <span className="text-[10px] text-slate-400">
                          ({u.completedTopicsCount}/{totalTopicsCount})
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400">
                      {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "No activity"}
                    </td>
                    <td className="p-3.5 text-right">
                      {!isSuper && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              promoteToAdmin(
                                u.userId,
                                u.role === "admin" ? "student" : "admin"
                              )
                            }
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                              u.role === "admin"
                                ? "text-slate-600 hover:bg-slate-100"
                                : "text-amber-700 bg-amber-50 hover:bg-amber-100"
                            }`}
                          >
                            {u.role === "admin" ? "Demote" : "Make Admin"}
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Delete account for ${u.name}?`)) {
                                deleteUser(u.userId);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}