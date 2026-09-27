"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useUser } from "./UserContext";
import { supabase } from "@/lib/supabaseClient";
import { MockTest } from "@/lib/types";

export default function ScoreTrendChart() {
  const { currentUser } = useUser();
  const [tests, setTests] = useState<MockTest[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form for adding new test
  const [form, setForm] = useState({
    test_date: new Date().toISOString().slice(0, 10),
    subject: "",
    score: "",
    max_score: "100",
  });

  // State for Editing Modal
  const [editingTest, setEditingTest] = useState<MockTest | null>(null);
  const [editForm, setEditForm] = useState({
    test_date: "",
    subject: "",
    score: "",
    max_score: "100",
  });

  useEffect(() => {
    if (currentUser) loadTests();
  }, [currentUser]);

  async function loadTests() {
    if (!currentUser) return;
    const { data } = await supabase
      .from("mock_tests")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("test_date", { ascending: true });

    if (data) setTests(data as MockTest[]);
  }

  async function addTest() {
    if (!currentUser || !form.score) return;

    await supabase.from("mock_tests").insert({
      user_id: currentUser.id,
      test_date: form.test_date,
      subject: form.subject.trim() || null,
      score: Number(form.score),
      max_score: Number(form.max_score) || 100,
    });

    setForm({
      test_date: new Date().toISOString().slice(0, 10),
      subject: "",
      score: "",
      max_score: "100",
    });
    loadTests();
  }

  function openEditModal(test: MockTest) {
    setEditingTest(test);
    setEditForm({
      test_date: test.test_date,
      subject: test.subject || "",
      score: String(test.score),
      max_score: String(test.max_score),
    });
  }

  async function saveEditedTest() {
    if (!editingTest || !editForm.score) return;

    await supabase
      .from("mock_tests")
      .update({
        test_date: editForm.test_date,
        subject: editForm.subject.trim() || null,
        score: Number(editForm.score),
        max_score: Number(editForm.max_score) || 100,
      })
      .eq("id", editingTest.id);

    setEditingTest(null);
    loadTests();
  }

  async function deleteTest(id: string) {
    await supabase.from("mock_tests").delete().eq("id", id);
    setDeletingId(null);
    loadTests();
  }

  const chartData = tests.map((t) => ({
    date: t.test_date,
    percentage: Math.round((t.score / t.max_score) * 100),
    subject: t.subject || "Full Mock",
    score: t.score,
    maxScore: t.max_score,
  }));

  return (
    <div className="space-y-6">
      {/* Log Form */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Log a Mock Test Score</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Test Date
            </label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              value={form.test_date}
              onChange={(e) => setForm({ ...form, test_date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Subject / Test Name
            </label>
            <input
              placeholder="e.g. Operating Systems / Full Mock 1"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Score Obtained
            </label>
            <input
              placeholder="e.g. 65"
              type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              value={form.score}
              onChange={(e) => setForm({ ...form, score: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Total / Max Score
            </label>
            <input
              placeholder="e.g. 100"
              type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              value={form.max_score}
              onChange={(e) => setForm({ ...form, max_score: e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={addTest}
          className="mt-4 bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          Save Score
        </button>
      </div>

      {/* Score Trend Chart */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Score Trend (%)</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No mock tests logged yet — add one above to see your trend.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: any, name: any, item: any) => [
                  `${value}% (${item.payload.score}/${item.payload.maxScore})`,
                  item.payload.subject,
                ]}
              />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke="#1f4e79"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Date-wise Test History & Management */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <div>
            <h3 className="font-semibold text-gray-800">Test History & Logs</h3>
            <p className="text-xs text-gray-400">
              Manage your logged mock tests date-wise.
            </p>
          </div>
          <button
            onClick={() => {
              setIsEditMode(!isEditMode);
              setDeletingId(null);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              isEditMode
                ? "bg-slate-800 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isEditMode ? "Done" : "Edit Logs"}
          </button>
        </div>

        <div className="space-y-2">
          {tests.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No tests recorded yet.
            </p>
          ) : (
            tests
              .slice()
              .reverse()
              .map((test) => {
                const pct = Math.round((test.score / test.max_score) * 100);

                return (
                  <div
                    key={test.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {/* Minus Button in Edit Mode */}
                      {isEditMode && (
                        <button
                          onClick={() =>
                            setDeletingId(deletingId === test.id ? null : test.id)
                          }
                          title="Delete test log"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors text-sm font-bold"
                        >
                          &minus;
                        </button>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">
                            {test.test_date}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand/10 text-brand">
                            {test.subject || "Full Length Test"}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">
                          {test.score} / {test.max_score}{" "}
                          <span className="text-xs font-normal text-gray-500">
                            ({pct}%)
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Actions in Edit Mode */}
                    {isEditMode && (
                      <div className="flex items-center gap-2">
                        {deletingId === test.id ? (
                          <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                            <button
                              onClick={() => deleteTest(test.id)}
                              className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors shadow-sm"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-2.5 py-1 text-xs bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openEditModal(test)}
                            className="text-xs px-2.5 py-1 text-gray-600 hover:text-slate-900 border rounded-md hover:bg-white transition-colors"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Edit Test Modal */}
      {editingTest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h4 className="font-semibold text-gray-800">Edit Mock Test Log</h4>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Test Date
                </label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  value={editForm.test_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, test_date: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Subject / Test Name
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  value={editForm.subject}
                  onChange={(e) =>
                    setEditForm({ ...editForm, subject: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Score
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                    value={editForm.score}
                    onChange={(e) =>
                      setEditForm({ ...editForm, score: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Max Score
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                    value={editForm.max_score}
                    onChange={(e) =>
                      setEditForm({ ...editForm, max_score: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingTest(null)}
                className="px-3.5 py-1.5 text-sm rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedTest}
                className="px-4 py-1.5 text-sm rounded-lg bg-brand text-white font-medium hover:opacity-90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}