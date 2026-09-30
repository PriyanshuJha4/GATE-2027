"use client";

import { useUser } from "./UserContext";

export function UserSwitcher() {
  const { currentUser, users, selectUser, isImpersonating, switchBackToAdmin } = useUser() as any;

  if (!currentUser) return null;

  return (
    <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 rounded-xl">
      <div className="overflow-hidden">
        <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.name}</p>
        <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
      </div>

      {isImpersonating ? (
        <button
          onClick={switchBackToAdmin}
          className="px-2 py-1 bg-amber-600/25 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-[10px] font-medium rounded transition cursor-pointer shrink-0"
        >
          Exit View
        </button>
      ) : (
        <span className="px-2 py-0.5 bg-indigo-600/20 text-indigo-400 text-[10px] font-semibold rounded uppercase shrink-0">
          {currentUser.role || "Student"}
        </span>
      )}
    </div>
  );
}

export default UserSwitcher;