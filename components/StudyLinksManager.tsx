"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useUser, SUPER_ADMIN_EMAIL } from "./UserContext";
import { supabase } from "@/lib/supabaseClient";
import { StudyLink } from "@/lib/types";

const BULK_PRESET_LINKS = [
  {
    title: "YEARWISE PREVIOUS YEAR PAPERS",
    url: "https://iitiansgateclasses.com/gate-previous-year-question-papers",
  },
  {
    title: "PDF UTILITY STUDIO",
    url: "https://pdf-utility-studio.vercel.app/",
  },
   {
    title: "TOPICWISE PYQs (KGAI)",
    url: "https://www.knowledgegate.ai/courses/GATE-GUIDANCE-BY-SANCHIT-SIR",
  },
   {
    title: "GATE Calculator",
    url: "https://gatecalculator.in/",
  },
];

export default function StudyLinksManager() {
  const { currentUser, isImpersonating } = useUser();
  const [links, setLinks] = useState<StudyLink[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Selection states for Bulk Delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Check if acting as genuine super admin
  const isRealAdmin = useMemo(() => {
    return (
      (currentUser?.role === "admin" || currentUser?.email === SUPER_ADMIN_EMAIL) &&
      !isImpersonating
    );
  }, [currentUser, isImpersonating]);

  const loadLinks = useCallback(async () => {
    let query = supabase
      .from("study_links")
      .select("*")
      .order("created_at", { ascending: true });

    // Global vs Personal filtering
    if (!isRealAdmin) {
      if (currentUser?.id) {
        query = query.or(`user_id.is.null,user_id.eq.${currentUser.id}`);
      } else {
        query = query.is("user_id", null);
      }
    }

    const { data, error } = await query;
    if (!error && data) {
      setLinks(data as StudyLink[]);
    }
  }, [currentUser, isRealAdmin]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  // 1-Click Import of 5 Links (Admin adds as global, student adds as personal)
  async function handleOneClickImport() {
    setIsImporting(true);

    const inserts = BULK_PRESET_LINKS.map((item) => ({
      user_id: isRealAdmin ? null : currentUser?.id || null,
      title: item.title,
      url: item.url,
    }));

    await supabase.from("study_links").insert(inserts);
    await loadLinks();
    setIsImporting(false);
  }

  function openAddModal() {
    setEditingId(null);
    setTitle("");
    setUrl("");
    setShowModal(true);
  }

  function openEditModal(link: StudyLink) {
    setEditingId(link.id);
    setTitle(link.title);
    setUrl(link.url);
    setShowModal(true);
  }

  async function saveLink() {
    if (!title.trim() || !url.trim()) return;

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    if (editingId) {
      await supabase
        .from("study_links")
        .update({ title: title.trim(), url: formattedUrl })
        .eq("id", editingId);
    } else {
      await supabase.from("study_links").insert({
        user_id: isRealAdmin ? null : currentUser?.id || null,
        title: title.trim(),
        url: formattedUrl,
      });
    }

    setShowModal(false);
    loadLinks();
  }

  // Single Delete
  async function deleteSingle(id: string) {
    await supabase.from("study_links").delete().eq("id", id);
    setDeletingId(null);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    loadLinks();
  }

  // Bulk Delete
  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    await supabase.from("study_links").delete().in("id", selectedIds);
    setSelectedIds([]);
    setShowBulkConfirm(false);
    loadLinks();
  }

  // Checkbox toggle logic
  const allSelected = links.length > 0 && selectedIds.length === links.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(links.map((l) => l.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white rounded-2xl border p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800">Frequently Used Links</h3>
            {isRealAdmin && (
              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                Admin Global Mode
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {isRealAdmin
              ? "Links added here are visible to all users globally."
              : "Click on any link title to open it directly in a new tab."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Add Button */}
          <button
            onClick={handleOneClickImport}
            disabled={isImporting}
            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isImporting ? "Adding..." : "⚡ Add All Preset Links"}
          </button>

          {/* Bulk Delete Controls */}
          {isEditMode && selectedIds.length > 0 && (
            <>
              {!showBulkConfirm ? (
                <button
                  onClick={() => setShowBulkConfirm(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  Delete Selected ({selectedIds.length})
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                  <button
                    onClick={deleteSelected}
                    className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowBulkConfirm(false)}
                    className="px-2.5 py-1 text-xs bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}

          {/* Edit Mode Toggle */}
          <button
            onClick={() => {
              setIsEditMode(!isEditMode);
              setDeletingId(null);
              setShowBulkConfirm(false);
              if (isEditMode) setSelectedIds([]);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              isEditMode
                ? "bg-slate-800 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isEditMode ? "Done" : "Edit Links"}
          </button>
        </div>
      </div>

      {/* Select All Option in Edit Mode */}
      {isEditMode && links.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl mb-3 border border-gray-100">
          <input
            type="checkbox"
            id="selectAllLinks"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
          />
          <label
            htmlFor="selectAllLinks"
            className="text-xs font-semibold text-gray-600 cursor-pointer select-none"
          >
            Select All ({selectedIds.length}/{links.length})
          </label>
        </div>
      )}

      {/* Link Rows */}
      <div className="space-y-2">
        {links.map((link) => {
          const isGlobal = (link as any).user_id === null;
          const canManage = isRealAdmin || (link as any).user_id === currentUser?.id;

          return (
            <div
              key={link.id}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50/80 transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Checkbox for Multiple Select */}
                {isEditMode && canManage && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(link.id)}
                    onChange={() => toggleSelectRow(link.id)}
                    className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
                  />
                )}

                {/* Single Minus Delete Button */}
                {isEditMode && canManage && (
                  <button
                    onClick={() =>
                      setDeletingId(deletingId === link.id ? null : link.id)
                    }
                    title="Delete link"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors text-sm font-bold cursor-pointer"
                  >
                    &minus;
                  </button>
                )}

                <div className="flex items-center gap-2 truncate">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand hover:underline truncate"
                  >
                    {link.title}
                  </a>
                  {isGlobal ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      Global
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      Personal
                    </span>
                  )}
                </div>
              </div>

              {/* Individual Actions in Edit Mode */}
              {isEditMode && canManage && (
                <div className="flex items-center gap-2 pl-2">
                  {deletingId === link.id ? (
                    <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                      <button
                        onClick={() => deleteSingle(link.id)}
                        className="px-2.5 py-1 text-xs bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-2.5 py-1 text-xs bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openEditModal(link)}
                      className="text-xs px-2.5 py-1 text-gray-600 hover:text-slate-900 border rounded-md hover:bg-white transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {links.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-400">
            No links added yet. Click &quot;Add All Preset Links&quot; above to load links in one click.
          </div>
        )}

        <button
          onClick={openAddModal}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-brand hover:bg-brand/5 hover:border-brand transition-all mt-3 cursor-pointer"
        >
          <span className="text-lg leading-none">+</span> Add Resource
        </button>
      </div>

      {/* Add / Edit Resource Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-800">
                {editingId ? "Edit Resource" : "Add Resource"}
              </h4>
              {isRealAdmin && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Global Link
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Resource Title
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="e.g. GATE PYQ Website"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Resource Link (URL)
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 text-sm rounded-lg border text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveLink}
                className="px-4 py-1.5 text-sm rounded-lg bg-brand text-white font-medium hover:opacity-90 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}