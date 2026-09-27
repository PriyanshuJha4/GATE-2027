"use client";

import { useState, useEffect } from "react";
import { GATE_SYLLABUS } from "@/lib/syllabus";
import { useUser } from "@/components/UserContext";
import { supabase } from "@/lib/supabaseClient";

export default function SyllabusPage() {
  const { currentUser } = useUser();
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Database se load karein
  useEffect(() => {
    // Agar user logged in nahi hai to loading band karke return karein
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const userId = currentUser.id;

    async function loadSyllabus() {
      setLoading(true);
      const { data } = await supabase
        .from("syllabus_progress")
        .select("topic_key")
        .eq("user_id", userId)
        .eq("completed", true);

      if (data) {
        setCompletedTopics(data.map((row) => row.topic_key));
      }
      setLoading(false);
    }

    loadSyllabus();
  }, [currentUser]);

  // 2. Checkbox toggle hote hi Supabase me update/insert karein
  const toggleTopic = async (topicKey: string) => {
    if (!currentUser) return;

    const userId = currentUser.id;
    const isCurrentlyChecked = completedTopics.includes(topicKey);
    const newStatus = !isCurrentlyChecked;

    // Optimistic UI update
    setCompletedTopics((prev) =>
      newStatus ? [...prev, topicKey] : prev.filter((t) => t !== topicKey)
    );

    await supabase.from("syllabus_progress").upsert(
      {
        user_id: userId,
        topic_key: topicKey,
        completed: newStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic_key" }
    );
  };

  const totalTopics = GATE_SYLLABUS.reduce(
    (acc, curr) => acc + curr.topics.length,
    0
  );
  const totalCompleted = completedTopics.length;
  const overallPercentage =
    totalTopics > 0 ? Math.round((totalCompleted / totalTopics) * 100) : 0;

  if (loading && currentUser) {
    return <p className="text-sm text-gray-400">Loading syllabus...</p>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              GATE 2027 Syllabus Tracker
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Mark topics as you complete them to track overall preparation.
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-extrabold text-indigo-600">
              {overallPercentage}%
            </span>
            <p className="text-xs text-slate-400 font-medium">
              {totalCompleted} / {totalTopics} Topics Completed
            </p>
          </div>
        </div>

        <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {GATE_SYLLABUS.map((item) => {
          const subjectCompleted = item.topics.filter((t) =>
            completedTopics.includes(`${item.subject}::${t}`)
          ).length;
          const subjectPercent = Math.round(
            (subjectCompleted / item.topics.length) * 100
          );

          return (
            <div
              key={item.subject}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">
                  {item.subject}
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  {subjectCompleted}/{item.topics.length} ({subjectPercent}%)
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${subjectPercent}%` }}
                />
              </div>

              <div className="space-y-2 pt-2">
                {item.topics.map((topic) => {
                  const key = `${item.subject}::${topic}`;
                  const isChecked = completedTopics.includes(key);

                  return (
                    <label
                      key={topic}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTopic(key)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span
                        className={`text-sm select-none ${
                          isChecked
                            ? "text-slate-400 line-through"
                            : "text-slate-700 group-hover:text-slate-900"
                        }`}
                      >
                        {topic}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}