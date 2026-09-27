"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserContext";
import { supabase } from "@/lib/supabaseClient";

export interface VaultItem {
  id: string;
  user_id: string;
  title: string;
  category: string;
  content?: string;
  url?: string;
  created_at?: string;
}

export default function FormulaVault() {
  const { currentUser } = useUser();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Mode & Actions State
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // New Note Form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Formula");
  const [customCategory, setCustomCategory] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editUrl, setEditUrl] = useState("");

  useEffect(() => {
    if (currentUser) loadItems();
  }, [currentUser]);

  async function loadItems() {
    if (!currentUser) return;
    const { data } = await supabase
      .from("formula_vault")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (data) setItems(data as VaultItem[]);
  }

  // URL sanitize function
  function formatHref(linkStr?: string) {
    if (!linkStr) return "";
    const trimmed = linkStr.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  async function addItem() {
    if (!currentUser || !title.trim()) return;

    const finalCategory =
      category === "Custom"
        ? customCategory.trim() || "General"
        : category.trim();

    await supabase.from("formula_vault").insert({
      user_id: currentUser.id,
      title: title.trim(),
      category: finalCategory,
      content: content.trim() || null,
      url: formatHref(url) || null,
    });

    setTitle("");
    setContent("");
    setUrl("");
    setCustomCategory("");
    loadItems();
  }

  function openEditModal(item: VaultItem) {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditContent(item.content || "");
    setEditUrl(item.url || "");
  }

  async function saveEditedItem() {
    if (!editingItem || !editTitle.trim()) return;

    await supabase
      .from("formula_vault")
      .update({
        title: editTitle.trim(),
        category: editCategory.trim() || "General",
        content: editContent.trim() || null,
        url: formatHref(editUrl) || null,
      })
      .eq("id", editingItem.id);

    setEditingItem(null);
    loadItems();
  }

  async function deleteSingle(id: string) {
    await supabase.from("formula_vault").delete().eq("id", id);
    setDeletingId(null);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    loadItems();
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    await supabase.from("formula_vault").delete().in("id", selectedIds);
    setSelectedIds([]);
    setShowBulkConfirm(false);
    loadItems();
  }

  // Filter & Search Logic
  const categoriesList = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean))
  );

  const filteredItems = items.filter((item) => {
    const matchCategory =
      categoryFilter === "ALL" || item.category === categoryFilter;
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.content &&
        item.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((i) => selectedIds.includes(i.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const currentIds = new Set(filteredItems.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const newIds = Array.from(
        new Set([...selectedIds, ...filteredItems.map((i) => i.id)])
      );
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
      {/* Add New Short Note / Link Form */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">
          Add Formula / Short Note / Resource
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Title (Will act as Clickable Link if URL provided)
            </label>
            <input
              type="text"
              placeholder="e.g. Master Theorem Notes / Dijkstra Shortcut"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Category
            </label>
            <div className="space-y-2">
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-brand"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Formula">Formula</option>
                <option value="Short Note">Short Note</option>
                <option value="YouTube Lecture">YouTube Lecture</option>
                <option value="Drive PDF">Drive PDF</option>
                <option value="Cheat Sheet">Cheat Sheet</option>
                <option value="Custom">+ Type Custom Category</option>
              </select>
              {category === "Custom" && (
                <input
                  type="text"
                  placeholder="Enter custom category name"
                  className="w-full border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Link / URL (Optional: Website, Drive, Notion, YouTube)
            </label>
            <input
              type="text"
              placeholder="https://drive.google.com/... or https://youtu.be/..."
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Description / Text Content (Formulas, pointers, breakdown)
            </label>
            <textarea
              rows={3}
              placeholder="Write formulas, summary, edge cases or revision pointers here..."
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={addItem}
          disabled={!title.trim()}
          className="mt-4 bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Save to Vault
        </button>
      </div>

      {/* Vault Listing Section */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b pb-3">
          <div>
            <h3 className="font-semibold text-gray-800">Saved Short Notes & Vault</h3>
            <p className="text-xs text-gray-400">
              Click the title to open link directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              {isEditMode ? "Done" : "Edit Vault"}
            </button>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by title, description or category..."
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-brand"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Select All Checkbox Row */}
        {isEditMode && filteredItems.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl mb-3 border border-gray-100">
            <input
              type="checkbox"
              id="selectAllVault"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              className="rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
            />
            <label
              htmlFor="selectAllVault"
              className="text-xs font-semibold text-gray-600 cursor-pointer select-none"
            >
              Select All ({selectedIds.length}/{filteredItems.length})
            </label>
          </div>
        )}

        {/* Vault Items List */}
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const hasUrl = Boolean(item.url && item.url.trim());
            const directLink = formatHref(item.url);

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-gray-100 hover:bg-gray-50/70 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 overflow-hidden flex-1">
                    {/* Checkbox in Edit Mode */}
                    {isEditMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelectRow(item.id)}
                        className="rounded border-gray-300 text-brand focus:ring-brand mt-1 cursor-pointer shrink-0"
                      />
                    )}

                    {/* Minus Button in Edit Mode */}
                    {isEditMode && (
                      <button
                        onClick={() =>
                          setDeletingId(deletingId === item.id ? null : item.id)
                        }
                        title="Delete note"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors text-sm font-bold mt-0.5"
                      >
                        &minus;
                      </button>
                    )}

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {item.category}
                        </span>

                        {/* Title: Direct Link if URL exists */}
                        {hasUrl ? (
                          <a
                            href={directLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-semibold text-brand hover:underline truncate"
                          >
                            {item.title} ↗
                          </a>
                        ) : (
                          <h4 className="text-base font-semibold text-gray-800 truncate">
                            {item.title}
                          </h4>
                        )}
                      </div>

                      {/* Description / Content Body */}
                      {item.content && (
                        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2">
                          {item.content}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Edit Mode Individual Actions */}
                  {isEditMode && (
                    <div className="flex items-center gap-2 shrink-0">
                      {deletingId === item.id ? (
                        <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                          <button
                            onClick={() => deleteSingle(item.id)}
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
                          onClick={() => openEditModal(item)}
                          className="text-xs px-2.5 py-1 text-gray-600 hover:text-slate-900 border rounded-md hover:bg-white transition-colors"
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

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              No formulas or notes found.
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <h4 className="font-semibold text-gray-800">Edit Vault Entry</h4>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Category
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Link / URL
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Description / Content
                </label>
                <textarea
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="px-3.5 py-1.5 text-sm rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedItem}
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