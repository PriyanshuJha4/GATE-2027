"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser, SUPER_ADMIN_EMAIL } from "@/components/UserContext";

interface LibraryItem {
  id: string;
  name: string;
  type: "folder" | "file";
  parent_id: string | null;
  user_id?: string | null;
  file_url: string | null;
  file_path: string | null;
  file_type: "pdf" | "video" | "image" | "note" | null;
  file_size?: number | null;
  storage_provider?: "supabase" | "cloudinary" | null;
  created_at: string;
}

export default function LibraryPage() {
  const { currentUser, isImpersonating } = useUser();

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [allItems, setAllItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  // Storage selection modal (For Files)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"cloudinary" | "supabase">("cloudinary");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Folder navigation history
  const [currentFolder, setCurrentFolder] = useState<LibraryItem | null>(null);
  const [folderPath, setFolderPath] = useState<LibraryItem[]>([]);

  // Modals & form state
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Markdown Note State with Storage Provider Selection
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteProvider, setNoteProvider] = useState<"supabase" | "cloudinary">("supabase");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Note Viewer State
  const [viewingNote, setViewingNote] = useState<LibraryItem | null>(null);
  const [viewingContent, setViewingContent] = useState<string>("");
  const [loadingNoteContent, setLoadingNoteContent] = useState(false);

  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Determine if acting as genuine super admin
  const isRealAdmin = useMemo(() => {
    return (
      (currentUser?.role === "admin" || currentUser?.email === SUPER_ADMIN_EMAIL) &&
      !isImpersonating
    );
  }, [currentUser, isImpersonating]);

  // 1. Fetch all items for storage indicator calculation
  const fetchAllStorageUsage = useCallback(async () => {
    let query = supabase
      .from("library_items")
      .select("id, file_size, storage_provider, type, user_id");

    if (!isRealAdmin) {
      if (currentUser?.id) {
        query = query.or(`user_id.is.null,user_id.eq.${currentUser.id}`);
      } else {
        query = query.is("user_id", null);
      }
    }

    const { data } = await query;
    if (data) {
      setAllItems(data as LibraryItem[]);
    }
  }, [isRealAdmin, currentUser]);

  // 2. Load folders and files for current level
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

    if (!isRealAdmin) {
      if (currentUser?.id) {
        query = query.or(`user_id.is.null,user_id.eq.${currentUser.id}`);
      } else {
        query = query.is("user_id", null);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching library items:", error.message);
    } else if (data) {
      setItems(data as LibraryItem[]);
    }
    setLoading(false);
  }, [currentFolder, isRealAdmin, currentUser]);

  useEffect(() => {
    fetchCurrentItems();
    fetchAllStorageUsage();
  }, [fetchCurrentItems, fetchAllStorageUsage]);

  const { supabaseUsedMB, cloudinaryUsedMB } = useMemo(() => {
    let sbBytes = 0;
    let cdBytes = 0;

    allItems.forEach((i) => {
      if (i.type === "file" && i.file_size) {
        if (i.storage_provider === "supabase") {
          sbBytes += Number(i.file_size);
        } else if (i.storage_provider === "cloudinary") {
          cdBytes += Number(i.file_size);
        }
      }
    });

    return {
      supabaseUsedMB: sbBytes / (1024 * 1024),
      cloudinaryUsedMB: cdBytes / (1024 * 1024),
    };
  }, [allItems]);

  const SUPABASE_MAX_MB = 1024;
  const CLOUDINARY_MAX_MB = 25600;

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

  // Create Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    const { data, error } = await supabase
      .from("library_items")
      .insert({
        name: newFolderName.trim(),
        type: "folder",
        parent_id: currentFolder ? currentFolder.id : null,
        user_id: isRealAdmin ? null : currentUser?.id || null,
      })
      .select()
      .single();

    if (error) {
      alert("Folder creation failed: " + error.message);
    } else if (data) {
      setItems((prev) => [...prev, data as LibraryItem]);
      setNewFolderName("");
      setShowCreateFolderModal(false);
    }
  };

  // Cloudinary Direct Upload for Files & Blobs
  const uploadToCloudinary = async (file: File | Blob, fileName: string) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary credentials missing in .env.local!");
    }

    const formData = new FormData();
    formData.append("file", file, fileName);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Cloudinary upload failed");
    }

    const data = await res.json();
    return { url: data.secure_url, publicId: data.public_id };
  };

  // Save Markdown Notes (.md file in Supabase or Cloudinary storage)
  const handleSaveMarkdownNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) {
      alert("Title aur Content dono required hain!");
      return;
    }

    setIsSavingNote(true);

    try {
      const cleanBaseName = noteTitle.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${cleanBaseName}.md`;
      const noteBlob = new Blob([noteContent], { type: "text/markdown" });
      const byteSize = noteBlob.size;

      let fileUrl = "";
      let filePath = "";

      if (noteProvider === "cloudinary") {
        const cloudRes = await uploadToCloudinary(noteBlob, fileName);
        fileUrl = cloudRes.url;
        filePath = cloudRes.publicId;
      } else {
        const storagePath = `notes/${currentFolder ? currentFolder.id : "root"}/${Date.now()}_${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("gate-library")
          .upload(storagePath, noteBlob, { contentType: "text/markdown", cacheControl: "3600" });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("gate-library")
          .getPublicUrl(storagePath);

        fileUrl = urlData.publicUrl;
        filePath = storagePath;
      }

      const { data: dbData, error: dbError } = await supabase
        .from("library_items")
        .insert({
          name: fileName,
          type: "file",
          parent_id: currentFolder ? currentFolder.id : null,
          user_id: isRealAdmin ? null : currentUser?.id || null,
          file_type: "note",
          file_url: fileUrl,
          file_path: filePath,
          file_size: byteSize,
          storage_provider: noteProvider,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (dbData) {
        setItems((prev) => [...prev, dbData as LibraryItem]);
        setAllItems((prev) => [...prev, dbData as LibraryItem]);
      }

      setNoteTitle("");
      setNoteContent("");
      setShowCreateNoteModal(false);
    } catch (err: any) {
      alert("Note save karne me error: " + err.message);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Open & Fetch Note text from Storage
  const handleOpenNoteViewer = async (item: LibraryItem) => {
    setViewingNote(item);
    setViewingContent("");
    setLoadingNoteContent(true);

    try {
      if (item.file_url) {
        const res = await fetch(item.file_url);
        const text = await res.text();
        setViewingContent(text);
      } else {
        setViewingContent("No content found.");
      }
    } catch (err) {
      setViewingContent("Note load karne me problem aayi.");
    } finally {
      setLoadingNoteContent(false);
    }
  };

  // Upload File (PDF/Image/Video)
  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    let fileCategory: "pdf" | "video" | "image" = "pdf";
    if (selectedFile.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|svg)$/i.test(selectedFile.name)) {
      fileCategory = "image";
    } else if (selectedFile.type.startsWith("video/") || /\.(mp4|mkv|webm)$/i.test(selectedFile.name)) {
      fileCategory = "video";
    }

    setUploading(true);
    setUploadProgressText(
      selectedProvider === "cloudinary"
        ? "Uploading to Cloudinary (25 GB)..."
        : "Uploading to Supabase Storage..."
    );

    try {
      let fileUrl = "";
      let filePath = "";

      if (selectedProvider === "cloudinary") {
        const cloudRes = await uploadToCloudinary(selectedFile, selectedFile.name);
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

      const { data: dbData, error: dbError } = await supabase
        .from("library_items")
        .insert({
          name: selectedFile.name,
          type: "file",
          parent_id: currentFolder ? currentFolder.id : null,
          user_id: isRealAdmin ? null : currentUser?.id || null,
          file_url: fileUrl,
          file_path: filePath,
          file_type: fileCategory,
          file_size: selectedFile.size,
          storage_provider: selectedProvider,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (dbData) {
        setItems((prev) => [...prev, dbData as LibraryItem]);
        setAllItems((prev) => [...prev, dbData as LibraryItem]);
      }

      setSelectedFile(null);
      setShowUploadModal(false);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgressText("");
    }
  };

  // Rename Item
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

  // Delete Item
  const handleDelete = async (item: LibraryItem) => {
    const isFolder = item.type === "folder";
    const confirmMsg = isFolder
      ? `Delete folder "${item.name}" and all contents inside?`
      : `Delete "${item.name}"?`;

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
      setAllItems((prev) => prev.filter((i) => i.id !== item.id));
      if (viewingNote?.id === item.id) setViewingNote(null);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">
              📚 GATE Preparation Library
            </h1>
            {isRealAdmin && (
              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                ADMIN (Global Creator)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Store PDFs, markdown study notes (.md), images, and video lectures across Supabase & Cloudinary.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            📁 + New Folder
          </button>

          <button
            onClick={() => setShowCreateNoteModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            📝 + Create Note (.md)
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            ⬆️ Upload File (PDF/Img/Vid)
          </button>
        </div>
      </div>

      {/* Cloud Storage Usage Indicator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Supabase Storage
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-800">
              {supabaseUsedMB.toFixed(2)} MB / 1 GB
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (supabaseUsedMB / SUPABASE_MAX_MB) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {((supabaseUsedMB / SUPABASE_MAX_MB) * 100).toFixed(1)}% used • Free tier limit: 1 GB
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Cloudinary Storage
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-800">
              {cloudinaryUsedMB >= 1024
                ? `${(cloudinaryUsedMB / 1024).toFixed(2)} GB / 25 GB`
                : `${cloudinaryUsedMB.toFixed(2)} MB / 25 GB`}
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (cloudinaryUsedMB / CLOUDINARY_MAX_MB) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {((cloudinaryUsedMB / CLOUDINARY_MAX_MB) * 100).toFixed(2)}% used • Free tier limit: 25 GB
          </p>
        </div>
      </div>

      {/* Breadcrumb Navigation Bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600 overflow-x-auto">
        <button
          onClick={() => handleNavigateBreadcrumb(-1)}
          className={`hover:text-indigo-600 font-semibold cursor-pointer ${
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
              className={`hover:text-indigo-600 cursor-pointer ${
                index === folderPath.length - 1 ? "text-indigo-600 font-bold" : ""
              }`}
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>

      {loading && (
        <p className="text-center py-8 text-sm text-slate-400">Loading library contents...</p>
      )}

      {/* Main Grid: Folders, Notes & Files */}
      {!loading && items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <p className="text-slate-400 text-sm">Yeh folder abhi khali hai.</p>
          <p className="text-xs text-slate-400 mt-1">
            Upar diye gaye buttons se Note (.md) paste karein ya PDF upload karein.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const isFolder = item.type === "folder";
            const isNote = item.file_type === "note";
            const isGlobalItem = item.user_id === null;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group"
              >
                <div
                  onClick={() => {
                    if (isFolder) handleOpenFolder(item);
                    else if (isNote) handleOpenNoteViewer(item);
                    else if (item.file_url) window.open(item.file_url, "_blank");
                  }}
                  className="cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">
                      {isFolder
                        ? "📁"
                        : isNote
                        ? "📝"
                        : item.file_type === "pdf"
                        ? "📄"
                        : item.file_type === "image"
                        ? "🖼️"
                        : "🎥"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isGlobalItem ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                          Global
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-600">
                          Personal
                        </span>
                      )}
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
                    </div>
                  </div>

                  <h3
                    className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-indigo-600 transition-colors"
                    title={item.name}
                  >
                    {item.name}
                  </h3>

                  {item.file_size ? (
                    <p className="text-[11px] text-slate-400">
                      {item.file_size < 1024 * 1024
                        ? `${(item.file_size / 1024).toFixed(1)} KB`
                        : `${(item.file_size / (1024 * 1024)).toFixed(2)} MB`}
                    </p>
                  ) : null}
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {(isRealAdmin || item.user_id === currentUser?.id) && (
                      <>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setRenameValue(item.name);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                          title="Rename"
                        >
                          ✏️
                        </button>

                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>

                  {isNote && (
                    <button
                      onClick={() => handleOpenNoteViewer(item)}
                      className="text-emerald-700 hover:underline font-semibold text-[11px] cursor-pointer"
                    >
                      Read Note ↗
                    </button>
                  )}

                  {!isFolder && !isNote && item.file_url && (
                    <div className="flex items-center gap-2">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline font-medium text-[11px]"
                      >
                        View
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
                      className="text-indigo-600 hover:underline font-medium text-[11px] cursor-pointer"
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

      {/* Modal 1: Create Note (.md) with Storage Choice */}
      {showCreateNoteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  📝 Save Markdown Notes (.md)
                </h3>
                <p className="text-xs text-slate-500">
                  Saves directly into cloud storage instead of cluttering the database.
                </p>
              </div>
              {isRealAdmin && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Global Note
                </span>
              )}
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {/* Storage Choice for Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Choose Storage Cloud for this Note:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition-all ${
                      noteProvider === "supabase"
                        ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="noteStorage"
                        checked={noteProvider === "supabase"}
                        onChange={() => setNoteProvider("supabase")}
                        className="text-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-800">Supabase Storage</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      1 GB Free • Instant fast loading for text
                    </span>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition-all ${
                      noteProvider === "cloudinary"
                        ? "border-sky-500 bg-sky-50/50 ring-1 ring-sky-500"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="noteStorage"
                        checked={noteProvider === "cloudinary"}
                        onChange={() => setNoteProvider("cloudinary")}
                        className="text-sky-600"
                      />
                      <span className="text-xs font-bold text-slate-800">Cloudinary (25 GB)</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      Massive 25 GB cloud capacity
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dijkstra Algorithm Explanation"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-indigo-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Markdown Content (Paste AI Output here)
                </label>
                <textarea
                  rows={10}
                  placeholder={`# Chapter Notes\n\nPaste here directly from ChatGPT or Gemini:\n- Key concept 1\n- Formula: Time Complexity = O(V + E)\n\n\`\`\`c\n// Code snippet\n\`\`\``}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-indigo-600 leading-relaxed bg-slate-50/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                disabled={isSavingNote}
                onClick={() => {
                  setShowCreateNoteModal(false);
                  setNoteTitle("");
                  setNoteContent("");
                }}
                className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isSavingNote}
                onClick={handleSaveMarkdownNote}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSavingNote ? "Uploading to Cloud..." : "Save Note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Readable Note Viewer */}
      {viewingNote && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>📝</span> {viewingNote.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-400">
                    Storage: <strong className="uppercase">{viewingNote.storage_provider}</strong>
                  </span>
                  <span className="text-[11px] text-slate-400">•</span>
                  <span className="text-[11px] text-slate-400">
                    Created {new Date(viewingNote.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(viewingContent);
                    alert("Note content copied to clipboard!");
                  }}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer text-slate-600"
                >
                  📋 Copy Text
                </button>
                <a
                  href={viewingNote.file_url || "#"}
                  download={viewingNote.name}
                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600"
                >
                  ⬇️ Download .md
                </a>
                <button
                  onClick={() => setViewingNote(null)}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer text-slate-700 font-semibold"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-xl border border-slate-200">
              {loadingNoteContent ? (
                <p className="text-xs text-slate-400 text-center py-10 animate-pulse">
                  Loading note from {viewingNote.storage_provider}...
                </p>
              ) : (
                <pre className="text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed text-slate-800 break-words font-normal">
                  {viewingContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Upload File (PDF/Image/Video) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Upload Study Resource</h3>
              {isRealAdmin && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Global Upload
                </span>
              )}
            </div>

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
                    25 GB Free • Best for Images, Videos & Large PDFs
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
                    1 GB Free • Good for Short Notes & Docs
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-slate-600 block">
                Select File (PDF, Image, or Video):
              </label>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp,video/mp4,video/mkv,video/webm"
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
                className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!selectedFile || uploading}
                onClick={handleConfirmUpload}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {uploading ? "Uploading..." : "Start Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Create Folder */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Create New Folder</h3>
            <input
              type="text"
              placeholder="e.g. Chapter 1 Notes, Diagrams"
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
                className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Rename Item */}
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
                className="px-3.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
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