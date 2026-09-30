"use client";

import { useEffect, useState, useCallback } from "react";
import LiveClock from "./LiveClock";
import { daysRemaining, formatCountdownLabel } from "@/lib/countdown";
import { useUser } from "./UserContext";
import { supabase } from "@/lib/supabaseClient";
import { MockTest } from "@/lib/types";
import { GATE_SYLLABUS } from "@/lib/syllabus";

const SYLLABUS_DEADLINE_DATE = "2026-11-30";

export default function DashboardHeader() {
  const { currentUser } = useUser();
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);

  // Total topics direct syllabus structure se count honge
  const totalTopics = GATE_SYLLABUS.reduce(
    (acc, curr) => acc + curr.topics.length,
    0
  );

  // Supabase se syllabus completed count laane ka function
  const fetchSyllabusProgress = useCallback(async () => {
    if (!currentUser) {
      setCompletedCount(0);
      return;
    }

    const { data, error } = await supabase
      .from("syllabus_progress")
      .select("topic_key")
      .eq("user_id", currentUser.id)
      .eq("completed", true);

    if (!error && data) {
      setCompletedCount(data.length);
    } else {
      setCompletedCount(0);
    }
  }, [currentUser]);

  // Mock tests data laane ka function
  const fetchMockTests = useCallback(async () => {
    if (!currentUser) {
      setMockTests([]);
      return;
    }

    const { data: tests } = await supabase
      .from("mock_tests")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("test_date", { ascending: false });

    setMockTests((tests as MockTest[]) || []);
  }, [currentUser]);

  useEffect(() => {
    fetchSyllabusProgress();
    fetchMockTests();

    // Focus hone par auto refresh
    const handleFocus = () => {
      fetchSyllabusProgress();
      fetchMockTests();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchSyllabusProgress, fetchMockTests]);

  // Pure syllabus topics ke basis par calculated percentage
  const syllabusPct =
    totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

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
        <Metric
          label="Syllabus Completion"
          value={`${syllabusPct}% (${completedCount}/${totalTopics})`}
        />
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