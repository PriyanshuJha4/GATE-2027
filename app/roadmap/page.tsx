"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@/components/UserContext";
import { generateDailySchedule, DayPlan } from "@/lib/roadmapPlan";

export default function RoadmapPage() {
  const { currentUser } = useUser();
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");

  const STORAGE_KEY = currentUser
    ? `gate-roadmap-schedule-${currentUser.id}`
    : "gate-roadmap-schedule-guest";

  useEffect(() => {
    const defaultSchedule = generateDailySchedule();
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setPlans(JSON.parse(saved));
        } catch {
          setPlans(defaultSchedule);
        }
      } else {
        setPlans(defaultSchedule);
      }
    } else {
      setPlans(defaultSchedule);
    }
  }, [STORAGE_KEY]);

  const saveToStorage = (updated: DayPlan[]) => {
    setPlans(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const visiblePlans = useMemo(() => {
    return plans.filter((p) => {
      const isUpcoming = p.date >= todayStr;
      if (!isUpcoming) return false;
      if (selectedMonth === "ALL") return true;
      return p.date.startsWith(selectedMonth);
    });
  }, [plans, todayStr, selectedMonth]);

  const toggleTask = (date: string, taskKey: keyof DayPlan["tasks"]) => {
    const updated = plans.map((p) => {
      if (p.date === date) {
        return {
          ...p,
          tasks: { ...p.tasks, [taskKey]: !p.tasks[taskKey] },
        };
      }
      return p;
    });
    saveToStorage(updated);
  };

  const startEditRow = (plan: DayPlan) => {
    setEditingDate(plan.date);
    setEditSubject(plan.subject === "—" ? "" : plan.subject);
    setEditTopic(plan.topic.includes("Final Buffer") ? "" : plan.topic);
  };

  const saveEditRow = (date: string) => {
    const updated = plans.map((p) => {
      if (p.date === date) {
        return {
          ...p,
          subject: editSubject.trim() || "—",
          topic: editTopic.trim() || "Free / Buffer Day",
        };
      }
      return p;
    });
    saveToStorage(updated);
    setEditingDate(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controller */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            GATE 2027 Master Study Plan
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            <strong>Syllabus Delivery:</strong> Till Nov 30, 2026 |{" "}
            <strong>Intensive Revision:</strong> Dec 1 – Jan 30, 2027 |{" "}
            <strong>Taper/Exam:</strong> Feb 2027
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs border rounded-lg px-3 py-2 bg-slate-50 outline-none text-slate-700"
          >
            <option value="ALL">All Months</option>
            <option value="2026-09">Sep 2026</option>
            <option value="2026-10">Oct 2026</option>
            <option value="2026-11">Nov 2026 (Syllabus End)</option>
            <option value="2026-12">Dec 2026 (Revision)</option>
            <option value="2027-01">Jan 2027 (Revision End)</option>
            <option value="2027-02">Feb 2027 (Exam Buffer)</option>
          </select>

          <button
            onClick={() => {
              setIsEditMode(!isEditMode);
              setEditingDate(null);
            }}
            className={`text-xs px-3.5 py-2 rounded-lg font-medium transition-colors ${
              isEditMode
                ? "bg-slate-900 text-white"
                : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            }`}
          >
            {isEditMode ? "Done Editing" : "Edit Rows"}
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-2.5">
        {visiblePlans.map((plan) => {
          const isToday = plan.date === todayStr;
          const isRowEditing = editingDate === plan.date;
          const isBlank = plan.phase === "BLANK";

          return (
            <div
              key={plan.date}
              className={`rounded-xl border p-4 transition-all shadow-sm ${
                isToday
                  ? "border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/20"
                  : isBlank
                  ? "border-dashed border-slate-200 bg-slate-50/60"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Date & Content */}
                <div className="flex items-start gap-4 min-w-[320px]">
                  <div
                    className={`text-center rounded-lg px-2.5 py-1.5 shrink-0 border ${
                      isBlank
                        ? "bg-slate-200/50 border-slate-300 text-slate-400"
                        : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase">
                      {plan.dayName}
                    </span>
                    <span className="block text-sm font-extrabold text-slate-800">
                      {plan.date.split("-")[2]}
                    </span>
                    <span className="block text-[9px] text-slate-400">
                      {plan.date.split("-")[1]}/{plan.date.split("-")[0].slice(2)}
                    </span>
                  </div>

                  <div className="overflow-hidden flex-1">
                    {isRowEditing ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          placeholder="Subject"
                          className="w-full text-xs font-semibold border rounded px-2 py-1 outline-none"
                        />
                        <input
                          type="text"
                          value={editTopic}
                          onChange={(e) => setEditTopic(e.target.value)}
                          placeholder="Topic / Content"
                          className="w-full text-xs border rounded px-2 py-1 outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              plan.phase === "SYLLABUS"
                                ? "bg-indigo-50 text-indigo-700"
                                : plan.phase === "REVISION"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {plan.phase === "BLANK" ? "BLANK BUFFER" : plan.subject}
                          </span>
                          {isToday && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              TODAY
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-sm mt-1 truncate ${
                            isBlank
                              ? "text-slate-400 font-normal italic"
                              : "text-slate-800 font-medium"
                          }`}
                        >
                          {plan.topic}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Non-Negotiable Tasks */}
                {!isBlank ? (
                  <div className="flex flex-wrap items-center gap-1.5 lg:gap-2 text-xs">
                    {(
                      [
                        { key: "classNotes", label: "Notes" },
                        { key: "dpp", label: "DPP" },
                        { key: "pyqs", label: "PYQs" },
                        { key: "mockTest", label: "Mock" },
                        { key: "errorLog", label: "Errors" },
                        { key: "shortNotes", label: "Revision" },
                      ] as { key: keyof DayPlan["tasks"]; label: string }[]
                    ).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => toggleTask(plan.date, t.key)}
                        className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                          plan.tasks[t.key]
                            ? "bg-emerald-500 text-white border-emerald-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        ✓ {t.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    Blank buffer window (Reserved for exam)
                  </div>
                )}

                {/* Edit Button */}
                {isEditMode && (
                  <div className="flex items-center justify-end gap-2 border-t pt-2 lg:border-t-0 lg:pt-0">
                    {isRowEditing ? (
                      <>
                        <button
                          onClick={() => saveEditRow(plan.date)}
                          className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingDate(null)}
                          className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEditRow(plan)}
                        className="px-2.5 py-1 text-xs border rounded-md text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}