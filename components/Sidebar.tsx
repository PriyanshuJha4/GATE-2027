"use client";

import { useState } from "react";
import Link from "next/link";
import UserSwitcher from "./UserSwitcher";
import { useUser } from "./UserContext";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Syllabus Tracker", href: "/syllabus" },
  { label: "📚 Library", href: "/library" },
  { label: "Weekly Matrix", href: "/weekly-matrix" },
  { label: "Error Log", href: "/error-log" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Frequently Used Links", href: "/study-links" },
  { label: "Formula Vault", href: "/formula-vault" },
  { label: "Subject Weightage", href: "/subject-weightage" },
  { label: "Mock Test Performance", href: "/analytics" },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { currentUser, signOut, deleteUser, isAdmin } = useUser();

  const handleSignOut = () => {
    setOpen(false);
    signOut();
  };

  const handleDeleteUser = async () => {
    if (!currentUser) return;
    setIsDeleting(true);
    const result = await deleteUser(currentUser.id);
    setIsDeleting(false);

    if (result.success) {
      setShowDeleteConfirm(false);
      setOpen(false);
    } else {
      alert(result.error || "Failed to delete user account.");
    }
  };

  return (
    <>
      {/* 1. Top Header Bar with Hamburger Button */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 hover:text-brand active:scale-95 transition-all flex items-center justify-center border border-gray-200 cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-extrabold text-gray-800 text-base tracking-tight">
            GATE 2027 Dashboard
          </span>
        </div>
      </header>

      {/* 2. Backdrop Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity duration-300"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 3. Slide-in Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-72 sm:w-80 bg-white border-r border-gray-200 p-5 z-50 transition-transform duration-300 ease-in-out overflow-y-auto flex flex-col justify-between shadow-2xl ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Header & Close (X) Button */}
          <div className="flex items-center justify-between mb-5 border-b pb-3">
            <h1 className="font-extrabold text-brand text-xl tracking-wide">
              GATE 2027
            </h1>
            <button
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* User Profile Card / Sign In */}
          <UserSwitcher />

          {/* Navigation Links */}
          <nav className="mt-5 space-y-1">
            {/* Admin-only Navigation Tab */}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200 mb-2 shadow-2xs"
              >
                <span>👑</span>
                <span>Admin Panel & Users</span>
              </Link>
            )}

            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-brand transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom Profile, Delete Account & Sign Out */}
        <div className="pt-4 mt-6 border-t border-gray-100 space-y-2">
          {currentUser && (
            <div className="mb-2 px-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {currentUser.name}
                </p>
                {isAdmin && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 truncate">
                {currentUser.email}
              </p>
            </div>
          )}

          {currentUser && (
            <div>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Account
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <p className="text-[11px] text-red-700 font-medium text-center">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="flex-1 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteUser}
                      disabled={isDeleting}
                      className="flex-1 py-1 text-xs rounded bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting..." : "Confirm"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentUser && (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          )}
        </div>
      </aside>
    </>
  );
}