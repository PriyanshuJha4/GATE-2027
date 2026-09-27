"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { GATE_SYLLABUS } from "@/lib/syllabus";
import { useUser } from "@/components/UserContext";
import { supabase } from "@/lib/supabaseClient";

interface TopicItem {
  id: string;
  subject: string;
  topic: string;
  notes_link?: string | null;
}

export default function SyllabusPage() {
  const { currentUser } = useUser();
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState<string[]>([]);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [editNotesLink, setEditNotesLink] = useState("");

  // New Subject / Topic Inputs
  const [newTopicInputs, setNewTopicInputs] = useState<Record<string, string>>({});
  const [newSubjectName, setNewSubjectName] = useState("");
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);

  // Active user resolver
  const getActiveUser = useCallback(() => {
    if (currentUser?.id) return currentUser;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("gate-prep-user");
        if (stored) return JSON.parse(stored);
      } catch (err) {
        console.error("User parse error:", err);
      }
    }
    return null;
  }, [currentUser]);

  // 1. Fetch Topics from Database & Auto-Populate if empty
  const fetchTopics = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("syllabus_topics")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch topics error:", error.message);
    } else if (data && data.length > 0) {
      setTopics(data);
    } else {
      // Seed default syllabus if DB is empty
      const initialRows: { subject: string; topic: string }[] = [];
      GATE_SYLLABUS.forEach((s) => {
        s.topics.forEach((t) => {
          initialRows.push({ subject: s.subject, topic: t });
        });
      });

      const { data: inserted, error: insertError } = await supabase
        .from("syllabus_topics")
        .insert(initialRows)
        .select();

      if (!insertError && inserted) {
        setTopics(inserted);
      }
    }
    setLoading(false);
  }, []);

  // 2. Fetch User Checklist Progress
  const fetchProgress = useCallback(async () => {
    const user = getActiveUser();
    if (!user?.id) return;

    const { data } = await supabase
      .from("syllabus_progress")
      .select("topic_key")
      .eq("user_id", user.id)
      .eq("completed", true);

    if (data) {
      setCompletedTopics(data.map((row) => row.topic_key));
    }
  }, [getActiveUser]);

  useEffect(() => {
    fetchTopics();
    fetchProgress();
  }, [fetchTopics, fetchProgress]);

  // Group topics by subject
  const subjectsMap = useMemo(() => {
    const map: Record<string, TopicItem[]> = {};
    topics.forEach((item) => {
      if (!map[item.subject]) {
        map[item.subject] = [];
      }
      map[item.subject].push(item);
    });
    return map;
  }, [topics]);

  // Toggle checklist
  const toggleTopicCheck = async (topicKey: string) => {
    const user = getActiveUser();
    if (!user?.id) {
      alert("⚠️ Kripya pehle Menu (☰) khol kar User profile select karein!");
      return;
    }

    const isCurrentlyChecked = completedTopics.includes(topicKey);
    const newStatus = !isCurrentlyChecked;

    setCompletedTopics((prev) =>
      newStatus ? [...prev, topicKey] : prev.filter((t) => t !== topicKey)
    );

    await supabase.from("syllabus_progress").upsert(
      {
        user_id: user.id,
        topic_key: topicKey,
        completed: newStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic_key" }
    );
  };

  // Save edited topic & notes link
  const handleSaveTopicEdit = async (topicId: string) => {
    if (!editTopicName.trim()) return;

    const { error } = await supabase
      .from("syllabus_topics")
      .update({
        topic: editTopicName.trim(),
        notes_link: editNotesLink.trim() || null,
      })
      .eq("id", topicId);

    if (error) {
      alert("Update failed: " + error.message);
    } else {
      setTopics((prev) =>
        prev.map((t) =>
          t.id === topicId
            ? { ...t, topic: editTopicName.trim(), notes_link: editNotesLink.trim() || null }
            : t
        )
      );
      setEditingTopicId(null);
    }
  };

  // Batch delete selected topics
  const handleBatchDelete = async () => {
    if (selectedToDelete.length === 0) return;
    if (!confirm(`Kya aap sach me ye ${selectedToDelete.length} topics delete karna chahte hain?`)) {
      return;
    }

    const { error } = await supabase
      .from("syllabus_topics")
      .delete()
      .in("id", selectedToDelete);

    if (error) {
      alert("Delete error: " + error.message);
    } else {
      setTopics((prev) => prev.filter((t) => !selectedToDelete.includes(t.id)));
      setSelectedToDelete([]);
    }
  };

  // Add new topic inside subject
  const handleAddTopic = async (subject: string) => {
    const topicText = newTopicInputs[subject]?.trim();
    if (!topicText) return;

    const { data, error } = await supabase
      .from("syllabus_topics")
      .insert({
        subject: subject,
        topic: topicText,
      })
      .select()
      .single();

    if (error) {
      alert("Topic add karne me error: " + error.message);
    } else if (data) {
      setTopics((prev) => [...prev, data]);
      setNewTopicInputs((prev) => ({ ...prev, [subject]: "" }));
    }
  };

  // Add new subject
  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;

    const { data, error } = await supabase
      .from("syllabus_topics")
      .insert({
        subject: newSubjectName.trim(),
        topic: "Introduction",
      })
      .select()
      .single();

    if (error) {
      alert("Subject add karne me error: " + error.message);
    } else if (data) {
      setTopics((prev) => [...prev, data]);
      setNewSubjectName("");
      setShowAddSubjectModal(false);
    }
  };

  const totalTopics = topics.length;
  const totalCompleted = completedTopics.length;
  const overallPercentage =
    totalTopics > 0 ? Math.round((totalCompleted / totalTopics) * 100) : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">
                GATE 2027 Syllabus Tracker
              </h1>
              <button
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  setSelectedToDelete([]);
                  setEditingTopicId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isEditMode
                    ? "bg-amber-600 text-white shadow-sm hover:bg-amber-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {isEditMode ? "✓ Done Editing" : "✏️ Edit Syllabus"}
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {isEditMode
                ? "Edit mode active: Rename topics, add notes links, or select multiple to delete."
                : "Mark topics as you complete them. Click topic name to open Google Drive notes."}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isEditMode && (
              <>
                <button
                  onClick={() => setShowAddSubjectModal(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100"
                >
                  + Add Subject
                </button>
                {selectedToDelete.length > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold shadow hover:bg-rose-700"
                  >
                    Delete Selected ({selectedToDelete.length})
                  </button>
                )}
              </>
            )}
            <div className="text-right">
              <span className="text-3xl font-extrabold text-indigo-600">
                {overallPercentage}%
              </span>
              <p className="text-xs text-slate-400 font-medium">
                {totalCompleted} / {totalTopics} Topics Completed
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400 text-center py-4">
          Loading syllabus from Supabase...
        </p>
      )}

      {/* Subject Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(subjectsMap).map(([subject, subjectTopics]) => {
          const subjectCompleted = subjectTopics.filter((t) =>
            completedTopics.includes(`${subject}::${t.topic}`)
          ).length;
          const subjectPercent =
            subjectTopics.length > 0
              ? Math.round((subjectCompleted / subjectTopics.length) * 100)
              : 0;

          return (
            <div
              key={subject}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-800">{subject}</h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    {subjectCompleted}/{subjectTopics.length} ({subjectPercent}%)
                  </span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-3 mb-4">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${subjectPercent}%` }}
                  />
                </div>

                {/* Topics List */}
                <div className="space-y-2">
                  {subjectTopics.map((item) => {
                    const key = `${subject}::${item.topic}`;
                    const isChecked = completedTopics.includes(key);
                    const isSelectedForDelete = selectedToDelete.includes(item.id);

                    if (editingTopicId === item.id) {
                      return (
                        <div
                          key={item.id}
                          className="p-3 border border-indigo-200 rounded-lg bg-indigo-50/50 space-y-2"
                        >
                          <input
                            type="text"
                            value={editTopicName}
                            onChange={(e) => setEditTopicName(e.target.value)}
                            placeholder="Chapter name"
                            className="w-full text-sm px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-indigo-500"
                          />
                          <input
                            type="url"
                            value={editNotesLink}
                            onChange={(e) => setEditNotesLink(e.target.value)}
                            placeholder="Google Drive notes link (https://drive.google.com/...)"
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-indigo-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingTopicId(null)}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveTopicEdit(item.id)}
                              className="px-3 py-1 text-xs bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          {isEditMode ? (
                            <input
                              type="checkbox"
                              checked={isSelectedForDelete}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedToDelete((prev) => [...prev, item.id]);
                                } else {
                                  setSelectedToDelete((prev) =>
                                    prev.filter((id) => id !== item.id)
                                  );
                                }
                              }}
                              className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTopicCheck(key)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          )}

                          {/* Topic Name & Drive link redirection */}
                          <div className="flex items-center gap-2 truncate">
                            {item.notes_link && !isEditMode ? (
                              <a
                                href={item.notes_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open Google Drive Notes"
                                className={`text-sm truncate hover:underline hover:text-indigo-600 ${
                                  isChecked
                                    ? "text-slate-400 line-through"
                                    : "text-slate-700 font-medium"
                                }`}
                              >
                                {item.topic}
                              </a>
                            ) : (
                              <span
                                className={`text-sm truncate select-none ${
                                  isChecked
                                    ? "text-slate-400 line-through"
                                    : "text-slate-700"
                                }`}
                              >
                                {item.topic}
                              </span>
                            )}

                            {/* Drive Notes badge if link is present */}
                            {item.notes_link && !isEditMode && (
                              <a
                                href={item.notes_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 shrink-0 hover:bg-blue-100"
                              >
                                🔗 Notes
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Edit Mode Actions */}
                        {isEditMode && (
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              onClick={() => {
                                setEditingTopicId(item.id);
                                setEditTopicName(item.topic);
                                setEditNotesLink(item.notes_link || "");
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100"
                              title="Edit chapter & link"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Delete "${item.topic}"?`)) {
                                  await supabase
                                    .from("syllabus_topics")
                                    .delete()
                                    .eq("id", item.id);
                                  setTopics((prev) =>
                                    prev.filter((t) => t.id !== item.id)
                                  );
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                              title="Delete chapter"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Topic to Subject (Edit Mode only) */}
              {isEditMode && (
                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <input
                    type="text"
                    placeholder="+ New topic name..."
                    value={newTopicInputs[subject] || ""}
                    onChange={(e) =>
                      setNewTopicInputs((prev) => ({
                        ...prev,
                        [subject]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTopic(subject);
                    }}
                    className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50"
                  />
                  <button
                    onClick={() => handleAddTopic(subject)}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Add New Subject</h3>
            <p className="text-xs text-slate-500">
              Create a new subject section for your GATE preparation syllabus.
            </p>
            <input
              type="text"
              placeholder="e.g. Linear Algebra, General Aptitude"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-indigo-600"
              autoFocus
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowAddSubjectModal(false);
                  setNewSubjectName("");
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubject}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
              >
                Create Subject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}