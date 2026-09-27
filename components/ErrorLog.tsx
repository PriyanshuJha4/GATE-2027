"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "./UserContext";
import { supabase } from "@/lib/supabaseClient";
import { ErrorLogEntry } from "@/lib/types";
import { getDueReviews } from "@/lib/spacedRepetition";
import { GATE_SYLLABUS } from "@/lib/syllabus";

const REASON_OPTIONS = [
  "Conceptual gap",
  "Silly mistake",
  "Misread question",
  "Time pressure",
  "Formula error",
  "Not revised recently",
];

export default function ErrorLog() {
  const { currentUser } = useUser();
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Edit Mode & Deletion States
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // New Log Form State
  const [form, setForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    subject: "",
    topic: "",
    question: "",
    reason: REASON_OPTIONS[0],
  });

  // Modal Editing State
  const [editingEntry, setEditingEntry] = useState<ErrorLogEntry | null>(null);
  const [editForm, setEditForm] = useState({
    log_date: "",
    subject: "",
    topic: "",
    question: "",
    reason: REASON_OPTIONS[0],
  });

  useEffect(() => {
    if (currentUser) loadEntries();
  }, [currentUser]);

  async function loadEntries() {
    if (!currentUser) return;
    const { data } = await supabase
      .from("error_logs")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("log_date", { ascending: false });

    if (data) setEntries(data as ErrorLogEntry[]);
  }

  // Topics for Add Form
  const availableFormTopics = useMemo(() => {
    if (!form.subject) return [];
    const found = GATE_SYLLABUS.find((s) => s.subject === form.subject);
    return found ? found.topics : [];
  }, [form.subject]);

  // Topics for Filter
  const availableFilterTopics = useMemo(() => {
    if (!subjectFilter) return [];
    const found = GATE_SYLLABUS.find((s) => s.subject === subjectFilter);
    return found ? found.topics : [];
  }, [subjectFilter]);

  // Topics for Edit Modal
  const availableEditTopics = useMemo(() => {
    if (!editForm.subject) return [];
    const found = GATE_SYLLABUS.find((s) => s.subject === editForm.subject);
    return found ? found.topics : [];
  }, [editForm.subject]);

  const handleSubjectChange = (selectedSubject: string) => {
    setForm((prev) => ({
      ...prev,
      subject: selectedSubject,
      topic: "",
    }));
  };

  const handleSubjectFilterChange = (selectedSubject: string) => {
    setSubjectFilter(selectedSubject);
    setTopicFilter("");
  };

  async function addEntry() {
    if (!currentUser || !form.subject.trim()) return;

    await supabase.from("error_logs").insert({
      user_id: currentUser.id,
      ...form,
    });

    setForm({
      ...form,
      subject: "",
      topic: "",
      question: "",
      reason: REASON_OPTIONS[0],
    });
    loadEntries();
  }

  // Single Delete
  async function deleteSingle(id: string) {
    await supabase.from("error_logs").delete().eq("id", id);
    setDeletingId(null);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    loadEntries();
  }

  // Bulk Delete
  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    await supabase.from("error_logs").delete().in("id", selectedIds);
    setSelectedIds([]);
    setShowBulkConfirm(false);
    loadEntries();
  }

  // Open Edit Modal
  function openEditModal(entry: ErrorLogEntry) {
    setEditingEntry(entry);
    setEditForm({
      log_date: entry.log_date,
      subject: entry.subject,
      topic: entry.topic || "",
      question: entry.question || "",
      reason: entry.reason || REASON_OPTIONS[0],
    });
  }

  async function saveEditedEntry() {
    if (!editingEntry || !editForm.subject.trim()) return;

    await supabase
      .from("error_logs")
      .update({
        log_date: editForm.log_date,
        subject: editForm.subject,
        topic: editForm.topic,
        question: editForm.question,
        reason: editForm.reason,
      })
      .eq("id", editingEntry.id);

    setEditingEntry(null);
    loadEntries();
  }

  const filtered = entries.filter((e) => {
    if (subjectFilter && e.subject !== subjectFilter) return false;
    if (topicFilter && e.topic !== topicFilter) return false;
    if (dateFilter && e.log_date !== dateFilter) return false;
    return true;
  });

  const dueReviews = getDueReviews(entries);

  // Checkbox Selection Logic
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selectedIds.includes(e.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map((e) => e.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const newIds = Array.from(new Set([...selectedIds, ...filtered.map((e) => e.id)]));
      setSelectedIds(newIds);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {dueReviews.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900 shadow-sm">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <span>⏰</span> {dueReviews.length} mistake(s) due for spaced re-testing today:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {dueReviews.map(({ entry, intervalDay }) => (
              <li key={entry.id}>
                {entry.subject} — {entry.topic || entry.question} (day {intervalDay} review)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Log Form */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <h3 className="font-semibold mb-4 text-gray-800">Log a New Mistake</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              value={form.log_date}
              onChange={(e) => setForm({ ...form, log_date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand bg-white"
              value={form.subject}
              onChange={(e) => handleSubjectChange(e.target.value)}
            >
              <option value="">-- Select Subject --</option>
              {GATE_SYLLABUS.map((s) => (
                <option key={s.subject} value={s.subject}>
                  {s.subject}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Chapter / Topic
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand bg-white disabled:bg-gray-100 disabled:text-gray-400"
              value={form.topic}
              disabled={!form.subject}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            >
              <option value="">
                {form.subject ? "-- Select Chapter/Topic --" : "Select Subject First"}
              </option>
              {availableFormTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Reason for Mistake
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand bg-white"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Question / What went wrong
            </label>
            <textarea
              placeholder="Explain what concept went wrong or paste question details..."
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              rows={2}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={addEntry}
          disabled={!form.subject}
          className="mt-4 bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Save Entry
        </button>
      </div>

      {/* Filter, Actions & Table View */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b pb-3">
          <div>
            <h3 className="font-semibold text-gray-800">Recorded Mistakes</h3>
            <p className="text-xs text-gray-400">
              Filter by subject, topic or manage and edit logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Delete Buttons (in Edit Mode) */}
            {isEditMode && selectedIds.length > 0 && (
              <>
                {!showBulkConfirm ? (
                  <button
                    onClick={() => setShowBulkConfirm(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Delete Selected ({selectedIds.length})
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                    <button
                      onClick={deleteSelected}
                      className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setShowBulkConfirm(false)}
                      className="px-2.5 py-1 text-xs bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Toggle Edit Mode */}
            <button
              onClick={() => {
                setIsEditMode(!isEditMode);
                setDeletingId(null);
                setShowBulkConfirm(false);
                if (isEditMode) setSelectedIds([]);
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
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-brand"
            value={subjectFilter}
            onChange={(e) => handleSubjectFilterChange(e.target.value)}
          >
            <option value="">All Subjects</option>
            {GATE_SYLLABUS.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject}
              </option>
            ))}
          </select>

          <select
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-brand disabled:bg-gray-100 disabled:text-gray-400"
            value={topicFilter}
            disabled={!subjectFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
          >
            <option value="">
              {subjectFilter ? "All Chapters / Topics" : "Select Subject First"}
            </option>
            {availableFilterTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b text-gray-500 bg-gray-50">
                {isEditMode && (
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
                    />
                  </th>
                )}
                <th className="p-3">Date</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Chapter / Topic</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Note / Question</th>
                {isEditMode && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b hover:bg-gray-50/70 transition-colors">
                  {isEditMode && (
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(e.id)}
                        onChange={() => toggleSelectRow(e.id)}
                        className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="p-3 whitespace-nowrap text-gray-500">{e.log_date}</td>
                  <td className="p-3 font-semibold text-gray-800">{e.subject}</td>
                  <td className="p-3 text-brand">{e.topic || "—"}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100 whitespace-nowrap">
                      {e.reason}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 max-w-xs truncate">{e.question || "—"}</td>

                  {/* Actions in Edit Mode */}
                  {isEditMode && (
                    <td className="p-3 text-right">
                      {deletingId === e.id ? (
                        <div className="inline-flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                          <button
                            onClick={() => deleteSingle(e.id)}
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
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(e)}
                            className="text-xs px-2.5 py-1 text-gray-600 hover:text-slate-900 border rounded-md hover:bg-white transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletingId(e.id)}
                            title="Delete log"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors text-sm font-bold"
                          >
                            &minus;
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={isEditMode ? 7 : 5}
                    className="p-6 text-center text-gray-400"
                  >
                    No mistakes logged for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <h4 className="font-semibold text-gray-800">Edit Mistake Entry</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  value={editForm.log_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, log_date: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Subject
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand bg-white"
                  value={editForm.subject}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      subject: e.target.value,
                      topic: "",
                    })
                  }
                >
                  {GATE_SYLLABUS.map((s) => (
                    <option key={s.subject} value={s.subject}>
                      {s.subject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Chapter / Topic
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand bg-white"
                  value={editForm.topic}
                  onChange={(e) =>
                    setEditForm({ ...editForm, topic: e.target.value })
                  }
                >
                  <option value="">-- Select Chapter/Topic --</option>
                  {availableEditTopics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Reason for Mistake
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand bg-white"
                  value={editForm.reason}
                  onChange={(e) =>
                    setEditForm({ ...editForm, reason: e.target.value })
                  }
                >
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Question / What went wrong
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  rows={2}
                  value={editForm.question}
                  onChange={(e) =>
                    setEditForm({ ...editForm, question: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-3.5 py-1.5 text-sm rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedEntry}
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