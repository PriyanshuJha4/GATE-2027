"use client";

import { useEffect, useState } from "react";
import LiveClock from "./LiveClock";
import { daysRemaining, formatCountdownLabel } from "@/lib/countdown";
import { useUser } from "./UserContext";
import { supabase } from "@/lib/supabaseClient";
import { WeeklyProgress, MockTest } from "@/lib/types";

const TOTAL_WEEKS = 19;
const TOTAL_TASKS_PER_WEEK = 6;

// Fallback date agar import issue ho
const SYLLABUS_DEADLINE_DATE = "2026-11-30";

export default function DashboardHeader() {
  const { currentUser } = useUser();
  const [progressRows, setProgressRows] = useState<WeeklyProgress[]>([]);
  const [mockTests, setMockTests] = useState<MockTest[]>([]);

  useEffect(() => {
    if (!currentUser) return;

    (async () => {
      const { data: progress } = await supabase
        .from("weekly_progress")
        .select("*")
        .eq("user_id", currentUser.id);

      const { data: tests } = await supabase
        .from("mock_tests")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("test_date", { ascending: false });

      if (progress) setProgressRows(progress as WeeklyProgress[]);
      if (tests) setMockTests(tests as MockTest[]);
    })();
  }, [currentUser]);

  const totalPossibleTasks = TOTAL_WEEKS * TOTAL_TASKS_PER_WEEK;
  const completedTasks = progressRows.reduce((sum, row) => {
    return (
      sum +
      Number(row.class_notes) +
      Number(row.dpp_questions) +
      Number(row.pyqs) +
      Number(row.mock_test) +
      Number(row.error_log) +
      Number(row.short_notes)
    );
  }, 0);

  const syllabusPct = totalPossibleTasks
    ? Math.round((completedTasks / totalPossibleTasks) * 100)
    : 0;

  const latestTest = mockTests.length > 0 ? mockTests[0] : null;
  const lastScorePct =
    latestTest && latestTest.max_score > 0
      ? Math.round((latestTest.score / latestTest.max_score) * 100)
      : null;

  return (
    <div className="bg-white rounded-2xl border p-5 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            Welcome{currentUser ? `, ${currentUser.name}` : ""}
          </h2>
          <p className="text-sm text-gray-500">GATE 2027 Preparation Dashboard</p>
        </div>
        <LiveClock />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
        <Metric
          label="Days to Syllabus Deadline"
          value={formatCountdownLabel(daysRemaining(SYLLABUS_DEADLINE_DATE))}
        />
        <Metric label="Syllabus Completion" value={`${syllabusPct}%`} />
        <Metric
          label="Last Mock Test Score"
          value={
            lastScorePct !== null
              ? `${lastScorePct}% (${latestTest?.score}/${latestTest?.max_score})`
              : "No tests yet"
          }
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-light rounded-xl p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-brand">{value}</div>
    </div>
  );
}