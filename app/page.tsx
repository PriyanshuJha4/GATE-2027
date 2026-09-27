"use client";

import Link from "next/link";
import { useUser } from "@/components/UserContext";

export default function DashboardPage() {
  const { currentUser } = useUser();

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome back, {currentUser?.username || "Aspirant"}! 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          GATE 2027 Dashboard - Track your syllabus progress, weightage, and mock tests here.
        </p>
      </div>

      {/* Quick Access Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Link to Syllabus Tracker */}
        <Link
          href="/syllabus"
          className="p-6 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:shadow-md transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600">
              Syllabus Tracker →
            </h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-1 rounded">
              Active
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Mark completed topics, review coverage, and track overall syllabus preparation.
          </p>
        </Link>

        {/* Subject Weightage Card */}
        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Subject Weightage</h2>
          <p className="text-sm text-slate-500 mt-2">
            View high-weightage topics and previous year mark distribution.
          </p>
        </div>

        {/* Mock Tests Card */}
        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Mock Tests</h2>
          <p className="text-sm text-slate-500 mt-2">
            Log your mock test scores, analyze accuracy, and target weak areas.
          </p>
        </div>
      </div>
    </div>
  );
}