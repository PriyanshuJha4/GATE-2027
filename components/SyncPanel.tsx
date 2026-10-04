"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api, getSyncKey, setSyncKey, uploadBackup, downloadToPhone, localState, exportPhoneZip, saveBlobAs,
  type LocalState, type Progress,
} from "@/lib/sync/client";
import { requestPersistence } from "@/lib/sync/idb";
import type { SyncManifest, Ack } from "@/lib/sync/core";

const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
const when = (s?: string | null) => (s ? new Date(s).toLocaleString() : "-");

type Cloud = { latest: SyncManifest | null; acks: Ack[]; cloudBytes: number; cloudFiles: number };

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3";
const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 cursor-pointer";

export default function SyncPanel() {
  const [key, setKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ phase: string; done: number; total: number; note?: string } | null>(null);
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [local, setLocal] = useState<LocalState | null>(null);
  const [store, setStore] = useState<{ persisted: boolean; usageMB: number; quotaMB: number } | null>(null);
  const [force, setForce] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onProgress: Progress = useCallback((p) => setProg(p), []);

  const refresh = useCallback(async () => {
    setLocal(await localState().catch(() => null));
    try { setStore(await requestPersistence()); } catch {}
    if (getSyncKey()) {
      try { setCloud(await api<Cloud>("status")); setConnected(true); } catch (e: any) { setConnected(false); setMsg({ kind: "err", text: e.message }); }
    }
  }, []);

  useEffect(() => { setKey(getSyncKey()); refresh(); }, [refresh]);

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(true); setMsg({ kind: "info", text: `${label}...` }); setProg(null);
    try {
      const done = await fn();
      setMsg({ kind: "ok", text: done || `${label}: done` });
    } catch (e: any) {
      setMsg({ kind: "err", text: `${label} FAILED: ${e?.message || e}` });
    } finally {
      setBusy(false); setProg(null); await refresh();
    }
  }

  const connect = () => run("Connect", async () => {
    setSyncKey(key.trim());
    const r = await api("ping");
    setConnected(true);
    return `Connected. Cloud bucket "${r.bucket}" is ready (max ${r.maxObjectMB} MB per file).`;
  });

  const upload = (f: File) => run("Upload to cloud", async () => {
    const m = await uploadBackup(f, onProgress);
    return `Uploaded and verified in the cloud: ${m.files.length} files, ${mb(m.totalBytes)}. Now open this page on your phone and press "Download to this phone".`;
  });

  const download = () => run("Download to phone", async () => {
    if (!cloud?.latest) throw new Error("There is nothing in the cloud. Upload the backup zip from the laptop first.");
    const r = await downloadToPhone(cloud.latest, onProgress);
    return `Saved on this phone: ${r.files} files (${mb(r.bytes)}), every file checked against its checksum.${r.keptLocalCards ? ` ${r.keptLocalCards} flashcard(s) were kept as they are on the phone because you reviewed them more recently.` : ""} You can now clean the cloud.`;
  });

  const clean = () => {
    if (!cloud?.latest) return;
    const verified = cloud.acks.filter((a) => a.ok && a.batchId === cloud.latest!.batchId).length;
    const text = verified
      ? `Delete the cloud copy (${cloud.cloudFiles} files, ${mb(cloud.cloudBytes)})? A phone has confirmed a verified download. Your data stays on the phone.`
      : `NO phone has confirmed a verified download. Deleting now can lose your only copy of anything that is not on the laptop. Really delete?`;
    if (!window.confirm(text)) return;
    run("Clean cloud", async () => {
      const r = await api("clean", { batchId: cloud.latest!.batchId, force });
      return `Cloud cleaned: ${r.deleted} files deleted, ${r.remaining} left.`;
    });
  };

  const exportZip = (withFiles: boolean) => run("Export", async () => {
    const blob = await exportPhoneZip(withFiles, onProgress);
    const d = new Date();
    saveBlobAs(blob, `gate-phone-copy-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}${withFiles ? "-with-files" : ""}.zip`);
    return `Zip created (${mb(blob.size)}). Find it in your phone's Downloads / Files app. Keep it somewhere safe: this is your permanent copy.`;
  });

  const latest = cloud?.latest;
  const verifiedAcks = latest ? cloud!.acks.filter((a) => a.ok && a.batchId === latest.batchId) : [];

  return (
    <div className="space-y-4 pb-16">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">Cloud sync: laptop → cloud → phone</h1>
        <p className="text-sm text-gray-600 mt-1">The cloud is only a bridge. Upload the offline dashboard's backup zip here, download it on the phone, then clean the cloud. The permanent copy lives on the phone.</p>
      </div>

      {msg && (
        <div role="status" className={`rounded-xl border px-3 py-2 text-sm ${msg.kind === "err" ? "border-red-300 bg-red-50 text-red-800" : msg.kind === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
          {msg.text}
        </div>
      )}
      {prog && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700">
          <div className="flex justify-between"><span className="font-semibold">{prog.phase}</span><span>{prog.done}/{prog.total}</span></div>
          <div className="h-2 mt-1 rounded bg-gray-100 overflow-hidden"><div className="h-2 bg-indigo-600" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} /></div>
          {prog.note && <div className="mt-1 truncate text-gray-500">{prog.note}</div>}
        </div>
      )}

      <section className={card}>
        <h2 className="font-bold text-gray-900">0. Connect</h2>
        <p className="text-xs text-gray-600">Enter the passphrase you set as <code>SYNC_ACCESS_KEY</code> in Vercel. It is stored only on this device.</p>
        <div className="flex gap-2">
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sync passphrase" autoComplete="off" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button disabled={busy || key.trim().length < 8} onClick={connect} className={`${btn} bg-indigo-600`}>{connected ? "Reconnect" : "Connect"}</button>
        </div>
        <p className="text-xs">{connected ? <span className="text-emerald-700">● connected</span> : <span className="text-gray-500">○ not connected</span>}</p>
      </section>

      <section className={card}>
        <h2 className="font-bold text-gray-900">Cloud right now</h2>
        {!connected ? <p className="text-sm text-gray-500">Connect first.</p> : !latest ? <p className="text-sm text-gray-700">Empty. Nothing is stored in the cloud.</p> : (
          <div className="text-sm text-gray-800 space-y-1">
            <p>Batch uploaded: <b>{when(latest.createdAt)}</b></p>
            <p>{cloud!.cloudFiles} objects · {mb(cloud!.cloudBytes)} · {latest.files.length} files in the backup</p>
            <p>Verified phone downloads: <b>{verifiedAcks.length}</b>{verifiedAcks.length > 0 && ` (${verifiedAcks.map((a) => `${a.deviceName}, ${when(a.at)}`).join("; ")})`}</p>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="font-bold text-gray-900">1. On the laptop: upload the backup zip</h2>
        <p className="text-xs text-gray-600">Offline dashboard → backup → "with PDFs" (<code>/api/backup?pdfs=1</code>). Each file up to 50 MB (free Supabase limit). Everything is checked after upload.</p>
        <input ref={fileRef} type="file" accept=".zip,application/zip" disabled={busy || !connected} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); if (fileRef.current) fileRef.current.value = ""; }} className="block w-full text-sm" />
      </section>

      <section className={card}>
        <h2 className="font-bold text-gray-900">2. On the phone: download</h2>
        <p className="text-xs text-gray-600">Saves PDFs, screenshots, flashcards and all tables inside this phone's app storage. Each file is verified (size + SHA-256) before the phone switches to the new copy. If it stops halfway, press again: finished files are not downloaded twice.</p>
        {local?.dirty && <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-2">This phone has flashcard reviews that are not exported yet. Newer phone reviews are kept, but export a zip (below) too.</p>}
        <button disabled={busy || !latest} onClick={download} className={`${btn} bg-emerald-600`}>Download to this phone</button>
      </section>

      <section className={card}>
        <h2 className="font-bold text-gray-900">3. Clean the cloud</h2>
        <p className="text-xs text-gray-600">Deletes the uploaded copy from Supabase Storage. Allowed only after a phone has confirmed a verified download.</p>
        <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> delete anyway (no phone has confirmed)</label>
        <button disabled={busy || !latest || (verifiedAcks.length === 0 && !force)} onClick={clean} className={`${btn} bg-red-600`}>Clean cloud</button>
      </section>

      <section className={card}>
        <h2 className="font-bold text-gray-900">This device</h2>
        {local?.currentBatch ? (
          <div className="text-sm text-gray-800 space-y-1">
            <p>Last synced: <b>{when(local.lastSync)}</b> · {local.files} files · {mb(local.bytes)}</p>
            <p className="text-xs text-gray-600">{Object.entries(local.tables).filter(([, n]) => n > 0).map(([t, n]) => `${t}: ${n}`).join(" · ")}</p>
          </div>
        ) : <p className="text-sm text-gray-600">Nothing stored on this device yet.</p>}
        {store && <p className="text-xs text-gray-600">Storage used: {store.usageMB} MB of {store.quotaMB} MB · protected from automatic cleanup: <b>{store.persisted ? "yes" : "NO"}</b>{!store.persisted && " (install the app: browser menu → Add to Home screen, then open it from there)"}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || !local?.currentBatch} onClick={() => exportZip(true)} className={`${btn} bg-slate-700`}>Save everything as ZIP to phone</button>
          <button disabled={busy || !local?.currentBatch} onClick={() => exportZip(false)} className={`${btn} bg-slate-500`}>Save data only (small ZIP)</button>
        </div>
        <p className="text-xs text-gray-500">The ZIP uses the same format as the offline dashboard's backup, so reviews you do on the phone can be restored on the laptop (merge mode).</p>
        <a href="/offline" className="inline-block text-sm font-semibold text-indigo-700 underline">Open offline library →</a>
      </section>
    </div>
  );
}
