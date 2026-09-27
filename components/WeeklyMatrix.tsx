"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "./UserContext";
import { supabase } from "@/lib/supabaseClient";
import { WeeklyProgress } from "@/lib/types";
import { WEEKLY_PLAN } from "@/lib/weeklyPlan";

const CHECKBOX_COLUMNS: { key: keyof WeeklyProgress; label: string }[] = [
  { key: "completed", label: "Completed" },
  { key: "class_notes", label: "Class Notes" },
  { key: "dpp_questions", label: "DPP Questions Notes" },
  { key: "pyqs", label: "PYQs" },
  { key: "mock_test", label: "Mock Test" },
  { key: "error_log", label: "Error Log" },
  { key: "short_notes", label: "Short Notes" },
];

function AutoResizeTextarea({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      onBlur={onBlur}
      className="w-full resize-none overflow-hidden rounded-lg border border-gray-200 bg-transparent p-2 text-xs leading-relaxed focus:border-brand focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
      placeholder="Focus areas..."
    />
  );
}

export default function WeeklyMatrix() {
  const { currentUser } = useUser();
  const [rows, setRows] = useState<Record<number, WeeklyProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    loadRows();
  }, [currentUser]);

  async function loadRows() {
    if (!currentUser) return;
    setLoading(true);

    // 1. Database se existing rows fetch karein
    const { data } = await supabase
      .from("weekly_progress")
      .select("*")
      .eq("user_id", currentUser.id);

    const byWeek: Record<number, WeeklyProgress> = {};
    (data as WeeklyProgress[] | null)?.forEach((row) => {
      byWeek[row.week_number] = row;
    });

    // 2. Missing weeks check karein (Week 1 to 19)
    const missingWeeks = WEEKLY_PLAN.filter((w) => !byWeek[w.weekNumber]);

    if (missingWeeks.length > 0) {
      const recordsToInsert = missingWeeks.map((week) => ({
        user_id: currentUser.id,
        week_number: week.weekNumber,
        focus_notes: week.focusAreas,
      }));

      const { data: createdRecords } = await supabase
        .from("weekly_progress")
        .insert(recordsToInsert)
        .select();

      if (createdRecords) {
        (createdRecords as WeeklyProgress[]).forEach((rec) => {
          byWeek[rec.week_number] = rec;
        });
      } else {
        // Database temporary delay/issue me bhi UI par week 1-19 visible rahe
        missingWeeks.forEach((week) => {
          byWeek[week.weekNumber] = {
            id: `temp-${week.weekNumber}`,
            user_id: currentUser.id,
            week_number: week.weekNumber,
            focus_notes: week.focusAreas,
            completed: false,
            class_notes: false,
            dpp_questions: false,
            pyqs: false,
            mock_test: false,
            error_log: false,
            short_notes: false,
            updated_at: new Date().toISOString(),
          };
        });
      }
    }

    setRows(byWeek);
    setLoading(false);
  }

  async function toggleCheckbox(weekNumber: number, key: keyof WeeklyProgress) {
    const row = rows[weekNumber];
    if (!row) return;

    const newValue = !row[key];
    setRows((prev) => ({ ...prev, [weekNumber]: { ...row, [key]: newValue } }));

    await supabase
      .from("weekly_progress")
      .update({ [key]: newValue, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  function updateFocusNotes(weekNumber: number, text: string) {
    const row = rows[weekNumber];
    if (!row) return;

    setRows((prev) => ({ ...prev, [weekNumber]: { ...row, focus_notes: text } }));
  }

  async function saveFocusNotes(weekNumber: number) {
    const row = rows[weekNumber];
    if (!row || row.id.startsWith("temp-")) return;

    await supabase
      .from("weekly_progress")
      .update({ focus_notes: row.focus_notes, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  if (loading) return <p className="text-sm text-gray-400">Loading matrix…</p>;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm overflow-x-auto">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        19-Week Non-Negotiables Matrix
      </h3>
      <table className="min-w-[950px] w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-gray-500">
            <th className="p-2">Week</th>
            <th className="p-2">Dates</th>
            <th className="p-2 min-w-[320px]">Focus Areas</th>
            {CHECKBOX_COLUMNS.map((col) => (
              <th key={col.key} className="p-2 text-center whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKLY_PLAN.map((week) => {
            const row = rows[week.weekNumber];
            if (!row) return null;

            return (
              <tr key={week.weekNumber} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                <td className="p-2 font-medium text-gray-800 whitespace-nowrap">
                  Week {week.weekNumber}
                </td>
                <td className="p-2 text-xs text-gray-500 whitespace-nowrap">
                  {week.dates}
                </td>
                <td className="p-2 align-top">
                  <AutoResizeTextarea
                    value={row.focus_notes ?? ""}
                    onChange={(val) => updateFocusNotes(week.weekNumber, val)}
                    onBlur={() => saveFocusNotes(week.weekNumber)}
                  />
                </td>
                {CHECKBOX_COLUMNS.map((col) => (
                  <td key={col.key} className="p-2 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={Boolean(row[col.key])}
                      onChange={() => toggleCheckbox(week.weekNumber, col.key)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}