"use client";

// Browser-side sync logic. Used by components/SyncPanel.tsx (upload / download / clean / export) and
// components/OfflineLibrary.tsx (reading the phone copy).

import { supabase } from "@/lib/supabaseClient";
import { idbGet, idbPut, idbPutMany, idbKeys, idbDeleteKeys } from "@/lib/sync/idb";
import { readZipBrowser, writeZipStore, sha256Hex, type ZipItem } from "@/lib/sync/zipBrowser";
import { MAX_OBJECT_BYTES, SYNC_FORMAT, newBatchId, objectKey, mergeCards, type SyncManifest, type SyncFile, type Ack } from "@/lib/sync/core";

const KEY_LS = "gate-sync-key";

/* ------------------------------ passphrase / device ------------------------------ */

export const getSyncKey = () => { try { return localStorage.getItem(KEY_LS) || ""; } catch { return ""; } };
export const setSyncKey = (k: string) => { try { k ? localStorage.setItem(KEY_LS, k) : localStorage.removeItem(KEY_LS); } catch {} };

export async function getDeviceId(): Promise<string> {
  let id = await idbGet<string>("meta", "deviceId");
  if (!id) { id = `dev_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`; await idbPut("meta", "deviceId", id); }
  return id;
}
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const kind = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone/iPad" : /Windows/i.test(ua) ? "Windows" : "browser";
  return `${kind} ${/Chrome|Safari|Firefox/.exec(ua)?.[0] || ""}`.trim();
}

/* --------------------------------- API calls --------------------------------- */

export async function api<T = any>(action: string, body: Record<string, any> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-key": getSyncKey() },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new Error("Cannot reach the server. Check the internet connection.");
  }
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) throw new Error(j?.error || `Server error ${res.status}`);
  return j as T;
}

export type Progress = (p: { phase: string; done: number; total: number; note?: string }) => void;

async function retry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
  throw new Error(`${label}: ${last?.message || last}`);
}

/* ------------------------- LAPTOP: backup zip -> cloud ------------------------- */

export async function uploadBackup(file: File, onProgress: Progress): Promise<SyncManifest> {
  onProgress({ phase: "Reading zip", done: 0, total: 1 });
  const items = await readZipBrowser(file);
  const mf = items.find((i) => i.name === "manifest.json");
  let backup: any;
  try { backup = JSON.parse(new TextDecoder().decode(mf?.data || new Uint8Array())); } catch {}
  if (!backup || backup.format !== "gate-dashboard-backup") throw new Error("This zip is not a backup made by the offline GATE dashboard (manifest.json missing).");

  const tooBig = items.filter((i) => i.data.length > MAX_OBJECT_BYTES);
  if (tooBig.length) throw new Error(`${tooBig.length} file(s) are larger than ${MAX_OBJECT_BYTES / 1048576} MB (free Supabase limit), e.g. ${tooBig[0].name}. Compress that PDF or upgrade the plan.`);

  const batchId = newBatchId();
  const files: SyncFile[] = [];
  for (let i = 0; i < items.length; i++) {
    onProgress({ phase: "Checksums", done: i, total: items.length, note: items[i].name });
    files.push({ path: items[i].name, key: objectKey(batchId, i), size: items[i].data.length, sha256: await sha256Hex(items[i].data) });
  }
  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  let uploaded = 0;
  for (let from = 0; from < files.length; from += 20) {
    const count = Math.min(20, files.length - from);
    const signed = await retry("Could not get upload URLs", () => api<{ bucket: string; items: { index: number; token: string; key: string }[] }>("sign-upload", { batchId, from, count }));
    for (const s of signed.items) {
      const f = files[s.index], data = items[s.index].data;
      onProgress({ phase: "Uploading to cloud", done: uploaded, total: files.length, note: f.path });
      await retry(`Upload failed for ${f.path}`, async () => {
        const { error } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(s.key, s.token, new Blob([data as BlobPart], { type: f.path.endsWith(".pdf") ? "application/pdf" : "application/octet-stream" }));
        if (error) throw new Error(error.message);
      });
      uploaded++;
    }
  }

  onProgress({ phase: "Verifying in cloud", done: files.length, total: files.length });
  const manifest: SyncManifest = { format: SYNC_FORMAT, batchId, createdAt: new Date().toISOString(), backup, files, totalBytes };
  await api("commit", { manifest });
  return manifest;
}

/* ---------------------------- PHONE: cloud -> device ---------------------------- */

export type LocalState = { currentBatch: string | null; lastSync: string | null; dirty: boolean; files: number; bytes: number; tables: Record<string, number> };

export async function localState(): Promise<LocalState> {
  const currentBatch = (await idbGet<string>("meta", "currentBatch")) || null;
  const lastSync = (await idbGet<string>("meta", "lastSync")) || null;
  const dirty = !!(await idbGet<boolean>("meta", "dirty"));
  const stats = (await idbGet<{ files: number; bytes: number }>("meta", "stats")) || { files: 0, bytes: 0 };
  const tables: Record<string, number> = {};
  for (const t of await idbKeys("tables")) tables[t] = ((await idbGet<any>("tables", t))?.rows || []).length;
  return { currentBatch, lastSync, dirty, files: stats.files, bytes: stats.bytes, tables };
}

export async function downloadToPhone(m: SyncManifest, onProgress: Progress): Promise<{ files: number; bytes: number; keptLocalCards: number }> {
  const cur = await idbGet<string>("meta", "currentBatch");
  const tables: Record<string, { columns: string[]; rows: any[] }> = {};
  const binary = m.files.filter((f) => !(f.path === "manifest.json" || /^tables\//.test(f.path)));
  const small = m.files.filter((f) => f.path !== "manifest.json" && /^tables\//.test(f.path));
  let doneN = 0, bytes = 0;
  const total = binary.length + small.length;

  const all = [...small, ...binary];
  for (let i = 0; i < all.length; i += 20) {
    const group = all.slice(i, i + 20);
    const signed = await retry("Could not get download URLs", () => api<{ urls: { key: string; url: string; error: string | null }[] }>("sign-download", { batchId: m.batchId, keys: group.map((g) => g.key) }));
    for (const f of group) {
      const isTable = f.path.startsWith("tables/");
      const idbKey = `${m.batchId}|${f.path}`;
      onProgress({ phase: "Downloading to phone", done: doneN, total, note: f.path });

      if (!isTable) {
        const have = await idbGet<{ size: number; sha256: string }>("files", idbKey);
        if (have && have.size === f.size && have.sha256 === f.sha256) { doneN++; bytes += f.size; continue; } // resume: already verified earlier
      }
      const u = signed.urls.find((x) => x.key === f.key);
      if (!u || u.error) throw new Error(`Cloud has no download URL for ${f.path}${u?.error ? ` (${u.error})` : ""}`);
      const blob = await retry(`Download failed for ${f.path}`, async () => {
        const r = await fetch(u.url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const b = await r.blob();
        if (b.size !== f.size) throw new Error(`size ${b.size} != expected ${f.size}`);
        if ((await sha256Hex(b)) !== f.sha256) throw new Error("checksum mismatch");
        return b;
      });
      if (isTable) {
        const j = JSON.parse(await blob.text());
        if (!Array.isArray(j.rows)) throw new Error(`Damaged table file ${f.path}`);
        tables[f.path.slice(7, -5)] = { columns: j.columns || [], rows: j.rows };
      } else {
        await idbPut("files", idbKey, { blob, size: f.size, sha256: f.sha256 });
      }
      bytes += f.size;
      doneN++;
    }
  }

  // every file arrived and matched its checksum: now (and only now) switch the phone to the new copy
  onProgress({ phase: "Saving on phone", done: total, total });
  let keptLocalCards = 0;
  const oldCards = await idbGet<{ rows: any[] }>("tables", "cards");
  if (tables.cards && oldCards?.rows?.length) {
    const merged = mergeCards(oldCards.rows, tables.cards.rows);
    tables.cards = { ...tables.cards, rows: merged.rows };
    keptLocalCards = merged.keptLocal;
  }
  await idbPutMany("tables", Object.entries(tables));
  const now = new Date().toISOString();
  await idbPutMany("meta", [["currentBatch", m.batchId], ["lastSync", now], ["stats", { files: binary.length, bytes }], ["backupInfo", m.backup]]);
  if (keptLocalCards === 0) await idbPut("meta", "dirty", false);

  const stale = (await idbKeys("files")).filter((k) => !k.startsWith(`${m.batchId}|`));
  await idbDeleteKeys("files", stale);

  await api("ack", { batchId: m.batchId, deviceId: await getDeviceId(), deviceName: deviceLabel(), ok: true, files: binary.length, bytes } satisfies Partial<Ack> & { batchId: string });
  return { files: binary.length, bytes, keptLocalCards };
}

/* ------------------------------- local reading ------------------------------- */

export async function getTable<T = any>(name: string): Promise<{ columns: string[]; rows: T[] }> {
  return (await idbGet<{ columns: string[]; rows: T[] }>("tables", name)) || { columns: [], rows: [] };
}

export async function saveCards(columns: string[], rows: any[]) {
  await idbPut("tables", "cards", { columns, rows });
  await idbPut("meta", "dirty", true); // there are phone-side reviews that the laptop does not have yet
}

export async function saveTable(name: string, columns: string[], rows: any[]) {
  await idbPut("tables", name, { columns, rows });
}

const urlCache = new Map<string, string>();
/** Object URL for a stored file (PDF / screenshot), or null if it is not on this phone. */
export async function fileUrl(path: string): Promise<string | null> {
  const batch = await idbGet<string>("meta", "currentBatch");
  if (!batch || !path) return null;
  const k = `${batch}|${String(path).replace(/\\/g, "/")}`;
  if (urlCache.has(k)) return urlCache.get(k)!;
  const f = await idbGet<{ blob: Blob }>("files", k);
  if (!f) return null;
  const type = path.toLowerCase().endsWith(".pdf") ? "application/pdf" : f.blob.type || "image/png";
  const u = URL.createObjectURL(new Blob([f.blob], { type }));
  urlCache.set(k, u);
  return u;
}

/* ------------- PHONE: permanent copy in the phone's own Downloads/Files ------------- */

/** Same zip layout as the offline dashboard's backup, so it can be restored there (Settings -> restore, merge mode). */
export async function exportPhoneZip(includeFiles: boolean, onProgress?: Progress): Promise<Blob> {
  const batch = await idbGet<string>("meta", "currentBatch");
  if (!batch) throw new Error("Nothing is stored on this phone yet.");
  const enc = new TextEncoder();
  const items: ZipItem[] = [];
  const counts: Record<string, number> = {};
  for (const t of await idbKeys("tables")) {
    const tab = await getTable(t);
    counts[t] = tab.rows.length;
    items.push({ name: `tables/${t}.json`, data: enc.encode(JSON.stringify({ columns: tab.columns, rows: tab.rows })) });
  }
  let shots = 0, pdfs = 0;
  if (includeFiles) {
    const keys = (await idbKeys("files")).filter((k) => k.startsWith(`${batch}|`));
    for (let i = 0; i < keys.length; i++) {
      const path = keys[i].slice(batch.length + 1);
      onProgress?.({ phase: "Packing", done: i, total: keys.length, note: path });
      const f = await idbGet<{ blob: Blob }>("files", keys[i]);
      if (!f) continue;
      items.push({ name: path, data: new Uint8Array(await f.blob.arrayBuffer()) });
      if (path.startsWith("pdfs/")) pdfs++; else shots++;
    }
  }
  const manifest = { format: "gate-dashboard-backup", version: 3, exportedAt: new Date().toISOString(), source: "phone-offline-copy", tables: counts, screenshots: shots, pdfFiles: pdfs, includesPdfFiles: includeFiles };
  items.unshift({ name: "manifest.json", data: enc.encode(JSON.stringify(manifest, null, 2)) });
  const blob = writeZipStore(items);
  await idbPut("meta", "dirty", false); // the user now holds a copy that includes the phone-side reviews
  return blob;
}

export function saveBlobAs(blob: Blob, filename: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60_000);
}