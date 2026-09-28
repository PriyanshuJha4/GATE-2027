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
  file_type: "pdf" | "video" | "note" | null;
  storage_provider?: "supabase" | "cloudinary" | null;
  created_at: string;
}

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  // Storage selection modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"cloudinary" | "supabase">("cloudinary");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      .order("type", { ascending: false })
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

  const handleOpenFolder = (folder: LibraryItem) => {
    setFolderPath((prev) => [...prev, folder]);
    setCurrentFolder(folder);
  };

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

  // Cloudinary Direct Upload Handler
  const uploadToCloudinary = async (file: File) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary credentials missing hain! .env.local check karein.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Cloudinary upload failed");
    }

    const data = await res.json();
    return {
      url: data.secure_url,
      publicId: data.public_id,
    };
  };

  // Process File Upload
  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    const isPdf = selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".pdf");
    const isVideo = selectedFile.type.startsWith("video/") || /\.(mp4|mkv|webm)$/i.test(selectedFile.name);
    const fileCategory: "pdf" | "video" = isVideo ? "video" : "pdf";

    setUploading(true);
    setUploadProgressText(
      selectedProvider === "cloudinary"
        ? "Uploading to Cloudinary (25 GB Cloud)..."
        : "Uploading to Supabase Storage..."
    );

    try {
      let fileUrl = "";
      let filePath = "";

      if (selectedProvider === "cloudinary") {
        const cloudRes = await uploadToCloudinary(selectedFile);
        fileUrl = cloudRes.url;
        filePath = cloudRes.publicId;
      } else {
        const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        filePath = `${currentFolder ? currentFolder.id : "root"}/${Date.now()}_${cleanFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("gate-library")
          .upload(filePath, selectedFile, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("gate-library")
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
      }

      // Save metadata in Supabase library_items
      const { data: dbData, error: dbError } = await supabase
        .from("library_items")
        .insert({
          name: selectedFile.name,
          type: "file",
          parent_id: currentFolder ? currentFolder.id : null,
          file_url: fileUrl,
          file_path: filePath,
          file_type: fileCategory,
          storage_provider: selectedProvider,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (dbData) setItems((prev) => [...prev, dbData]);

      // Reset modal state
      setSelectedFile(null);
      setShowUploadModal(false);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgressText("");
    }
  };

  // Add Link / Web Note
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
        storage_provider: null,
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

  // Rename
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

  // Delete
  const handleDelete = async (item: LibraryItem) => {
    const isFolder = item.type === "folder";
    const confirmMsg = isFolder
      ? `Kya aap "${item.name}" folder aur iske andar ka sabhi material delete karna chahte hain?`
      : `Kya aap "${item.name}" delete karna chahte hain?`;

    if (!confirm(confirmMsg)) return;

    try {
      if (item.file_path && item.storage_provider === "supabase") {
        await supabase.storage.from("gate-library").remove([item.file_path]);
      }

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
            Store PDFs, video lectures, and revision notes across Supabase and Cloudinary.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            📁 + New Folder
          </button>

          <button
            onClick={() => setShowAddNoteModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            📝 + Add Note Link
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
          >
            ⬆️ Upload File (PDF/Video)
          </button>
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
            Upar diye gaye buttons se PDF/Video upload karein ya subfolder banayein.
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
                        : item.file_type === "video"
                        ? "🎥"
                        : "🔗"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.storage_provider && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            item.storage_provider === "cloudinary"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {item.storage_provider === "cloudinary" ? "Cloudinary" : "Supabase"}
                        </span>
                      )}
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                        {isFolder ? "Folder" : item.file_type}
                      </span>
                    </div>
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

                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>

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

      {/* Modal: Upload File (Cloud Selection) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              Upload Study Resource
            </h3>

            {/* Storage Provider Radio */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">
                Choose Storage Cloud:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                    selectedProvider === "cloudinary"
                      ? "border-sky-500 bg-sky-50/50 ring-1 ring-sky-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="provider"
                      checked={selectedProvider === "cloudinary"}
                      onChange={() => setSelectedProvider("cloudinary")}
                      className="text-sky-600"
                    />
                    <span className="text-xs font-bold text-slate-800">Cloudinary</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1">
                    25 GB Free • Best for Videos & Large PDFs
                  </span>
                </label>

                <label
                  className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                    selectedProvider === "supabase"
                      ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="provider"
                      checked={selectedProvider === "supabase"}
                      onChange={() => setSelectedProvider("supabase")}
                      className="text-emerald-600"
                    />
                    <span className="text-xs font-bold text-slate-800">Supabase</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1">
                    1 GB Free • Good for Short Notes
                  </span>
                </label>
              </div>
            </div>

            {/* File Selector */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-slate-600 block">
                Select File (.pdf, .mp4, .mkv):
              </label>
              <input
                type="file"
                accept=".pdf,video/mp4,video/mkv,video/webm"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-lg p-1.5"
              />
            </div>

            {uploading && (
              <p className="text-xs text-indigo-600 font-medium animate-pulse text-center">
                {uploadProgressText}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                disabled={uploading}
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={!selectedFile || uploading}
                onClick={handleConfirmUpload}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
              >
                {uploading ? "Uploading..." : "Start Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Folder */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Create New Folder</h3>
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