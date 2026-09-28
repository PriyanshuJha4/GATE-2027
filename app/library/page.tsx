"use client";

import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

interface LibraryItem {
  id: string;
  name: string;
  type: "folder" | "file";
  parent_id: string | null;
  file_url: string | null;
  file_path: string | null;
  file_type: "pdf" | "note" | null;
  created_at: string;
}

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Folder navigation history
  const [currentFolder, setCurrentFolder] = useState<LibraryItem | null>(null);
  const [folderPath, setFolderPath] = useState<LibraryItem[]>([]);

  // Modals & form state
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteLink, setNoteLink] = useState("");

  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // 1. Current level ke folder aur files load karna
  const fetchCurrentItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("library_items")
      .select("*")
      .order("type", { ascending: false }) // Folders pehle dikhenge
      .order("name", { ascending: true });

    if (currentFolder) {
      query = query.eq("parent_id", currentFolder.id);
    } else {
      query = query.is("parent_id", null);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching library items:", error.message);
    } else if (data) {
      setItems(data);
    }
    setLoading(false);
  }, [currentFolder]);

  useEffect(() => {
    fetchCurrentItems();
  }, [fetchCurrentItems]);

  // Folder ke andar jana
  const handleOpenFolder = (folder: LibraryItem) => {
    setFolderPath((prev) => [...prev, folder]);
    setCurrentFolder(folder);
  };

  // Breadcrumb se kisi folder par lautna
  const handleNavigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setFolderPath([]);
      setCurrentFolder(null);
    } else {
      const nextFolder = folderPath[index];
      setFolderPath((prev) => prev.slice(0, index + 1));
      setCurrentFolder(nextFolder);
    }
  };

  // Naya Folder / Subfolder create karna
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    const { data, error } = await supabase
      .from("library_items")
      .insert({
        name: newFolderName.trim(),
        type: "folder",
        parent_id: currentFolder ? currentFolder.id : null,
      })
      .select()
      .single();

    if (error) {
      alert("Folder creation failed: " + error.message);
    } else if (data) {
      setItems((prev) => [...prev, data]);
      setNewFolderName("");
      setShowCreateFolderModal(false);
    }
  };

  // PDF Upload karna (Supabase Storage)
  const handleUploadPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Kripya sirf PDF file select karein!");
      return;
    }

    setUploading(true);
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${currentFolder ? currentFolder.id : "root"}/${Date.now()}_${cleanFileName}`;

      // Supabase storage bucket me upload
      const { error: uploadError } = await supabase.storage
        .from("gate-library")
        .upload(storagePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      // Public URL generate karna
      const { data: urlData } = supabase.storage
        .from("gate-library")
        .getPublicUrl(storagePath);

      // Database me record save karna
      const { data: dbData, error: dbError } = await supabase
        .from("library_items")
        .insert({
          name: file.name,
          type: "file",
          parent_id: currentFolder ? currentFolder.id : null,
          file_url: urlData.publicUrl,
          file_path: storagePath,
          file_type: "pdf",
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (dbData) setItems((prev) => [...prev, dbData]);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Link / Web Note add karna
  const handleAddNote = async () => {
    if (!noteTitle.trim() || !noteLink.trim()) return;

    const { data, error } = await supabase
      .from("library_items")
      .insert({
        name: noteTitle.trim(),
        type: "file",
        parent_id: currentFolder ? currentFolder.id : null,
        file_url: noteLink.trim(),
        file_type: "note",
      })
      .select()
      .single();

    if (error) {
      alert("Note add karne me error: " + error.message);
    } else if (data) {
      setItems((prev) => [...prev, data]);
      setNoteTitle("");
      setNoteLink("");
      setShowAddNoteModal(false);
    }
  };

  // Rename handle karna
  const handleRename = async () => {
    if (!editingItem || !renameValue.trim()) return;

    const { error } = await supabase
      .from("library_items")
      .update({ name: renameValue.trim() })
      .eq("id", editingItem.id);

    if (error) {
      alert("Rename error: " + error.message);
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id ? { ...i, name: renameValue.trim() } : i
        )
      );
      setEditingItem(null);
      setRenameValue("");
    }
  };

  // Delete karna (File bucket aur database dono se hategi)
  const handleDelete = async (item: LibraryItem) => {
    const isFolder = item.type === "folder";
    const confirmMsg = isFolder
      ? `Kya aap "${item.name}" folder aur iske andar ki sabhi files delete karna chahte hain?`
      : `Kya aap "${item.name}" file delete karna chahte hain?`;

    if (!confirm(confirmMsg)) return;

    try {
      // Agar file hai aur storage me hai toh storage se delete karein
      if (item.file_path) {
        await supabase.storage.from("gate-library").remove([item.file_path]);
      }

      // Database se delete karein
      const { error } = await supabase
        .from("library_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            📚 GATE Preparation Library
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Subject-wise PDF resources, short revision notes, and study material.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Create Subfolder */}
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            📁 + New Folder
          </button>

          {/* Add Online Note */}
          <button
            onClick={() => setShowAddNoteModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            📝 + Add Note Link
          </button>

          {/* Upload PDF */}
          <label className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer">
            {uploading ? "Uploading..." : "📄 Upload PDF"}
            <input
              type="file"
              accept=".pdf"
              onChange={handleUploadPdf}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Breadcrumb Navigation Bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600 overflow-x-auto">
        <button
          onClick={() => handleNavigateBreadcrumb(-1)}
          className={`hover:text-indigo-600 font-semibold ${
            folderPath.length === 0 ? "text-indigo-600 font-bold" : ""
          }`}
        >
          Root Library
        </button>
        {folderPath.map((folder, index) => (
          <div key={folder.id} className="flex items-center gap-2">
            <span>/</span>
            <button
              onClick={() => handleNavigateBreadcrumb(index)}
              className={`hover:text-indigo-600 ${
                index === folderPath.length - 1
                  ? "text-indigo-600 font-bold"
                  : ""
              }`}
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>

      {loading && (
        <p className="text-center py-8 text-sm text-slate-400">
          Loading library contents...
        </p>
      )}

      {/* Main Grid: Folders & Files */}
      {!loading && items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <p className="text-slate-400 text-sm">Yeh folder abhi khali hai.</p>
          <p className="text-xs text-slate-400 mt-1">
            Upar diye gaye buttons se PDF upload karein ya subfolder banayein.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const isFolder = item.type === "folder";

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group"
              >
                {/* Content Icon & Name */}
                <div
                  onClick={() => {
                    if (isFolder) handleOpenFolder(item);
                    else if (item.file_url) {
                      window.open(item.file_url, "_blank");
                    }
                  }}
                  className="cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">
                      {isFolder
                        ? "📁"
                        : item.file_type === "pdf"
                        ? "📄"
                        : "🔗"}
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                      {isFolder ? "Folder" : item.file_type}
                    </span>
                  </div>

                  <h3
                    className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-indigo-600 transition-colors"
                    title={item.name}
                  >
                    {item.name}
                  </h3>
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {/* Rename Button */}
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setRenameValue(item.name);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                      title="Rename"
                    >
                      ✏️
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Open / Download */}
                  {!isFolder && item.file_url && (
                    <div className="flex items-center gap-2">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline font-medium text-[11px]"
                      >
                        Open
                      </a>
                      <a
                        href={item.file_url}
                        download
                        className="text-slate-500 hover:text-slate-800 text-[11px]"
                      >
                        ⬇️
                      </a>
                    </div>
                  )}

                  {isFolder && (
                    <button
                      onClick={() => handleOpenFolder(item)}
                      className="text-indigo-600 hover:underline font-medium text-[11px]"
                    >
                      Browse →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Folder */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              Create New Folder
            </h3>
            <input
              type="text"
              placeholder="e.g. Chapter 1 Notes, PYQs"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-indigo-600"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setNewFolderName("");
                }}
                className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Note Link */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Add Note Link</h3>
            <input
              type="text"
              placeholder="Note Title (e.g. Short Notes)"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-indigo-600"
            />
            <input
              type="url"
              placeholder="URL (Google Drive, Notion link, etc.)"
              value={noteLink}
              onChange={(e) => setNoteLink(e.target.value)}
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-indigo-600"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddNoteModal(false);
                  setNoteTitle("");
                  setNoteLink("");
                }}
                className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rename Item */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Rename</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-indigo-600"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingItem(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
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