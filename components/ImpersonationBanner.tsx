"use client";

import { useUser } from "./UserContext";

export default function ImpersonationBanner() {
  const { isImpersonating, currentUser, adminUser, users, selectUser, switchBackToAdmin } = useUser();

  if (!isImpersonating) return null;

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-slate-900 px-4 py-2 shadow-md flex flex-wrap items-center justify-between gap-2 border-b border-amber-600 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-base">👁️</span>
        <span>
          Viewing as Student: <strong className="font-bold underline">{currentUser?.name}</strong> ({currentUser?.email})
        </span>
        <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded font-semibold">
          Admin Preview Mode
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Switch to another student without signing out */}
        <select
          value={currentUser?.id}
          onChange={(e) => {
            const nextUser = users.find((u) => u.id === e.target.value);
            if (nextUser) selectUser(nextUser);
          }}
          className="bg-white text-slate-800 text-xs rounded px-2 py-1 border border-amber-300 font-medium"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role === "admin" ? "Admin" : "Student"})
            </option>
          ))}
        </select>

        {/* 1-Click Back to Admin */}
        <button
          onClick={switchBackToAdmin}
          className="bg-slate-900 hover:bg-black text-white px-3 py-1 rounded font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
        >
          ↩ Return to Admin ({adminUser?.name?.split(" ")[0]})
        </button>
      </div>
    </div>
  );
}