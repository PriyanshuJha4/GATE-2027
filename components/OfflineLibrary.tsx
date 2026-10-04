"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTable, saveCards, saveTable, fileUrl, localState, type LocalState } from "@/lib/sync/client";
import { reviewCard, localDate, type Rating } from "@/lib/sync/core";

type Tab = "cards" | "errors" | "pdfs";
const box = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";

function Img({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => { let on = true; fileUrl(path).then((u) => on && setSrc(u)); return () => { on = false; }; }, [path]);
  if (src === undefined) return <div className="h-20 rounded-lg bg-gray-100 animate-pulse" />;
  if (src === null) return <p className="text-xs text-red-600">Image file is not on this phone ({path})</p>;
  return <img src={src} alt={alt} className="max-w-full rounded-lg border border-gray-200" />;
}

function Cards() {
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [subject, setSubject] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const today = localDate();

  useEffect(() => { getTable("cards").then((t) => { setCols(t.columns); setRows(t.rows); setLoaded(true); }).catch((e) => setErr(e.message)); }, []);

  const subjects = useMemo(() => Array.from(new Set(rows.map((r) => String(r.subject || "")))).filter(Boolean).sort(), [rows]);
  const due = useMemo(() => rows.filter((r) => String(r.due || "") <= today && (subject === "all" || r.subject === subject)).sort((a, b) => String(a.due).localeCompare(String(b.due))), [rows, today, subject]);
  const cur = due[0];

  const rate = useCallback(async (q: Rating) => {
    if (!cur) return;
    const updated = reviewCard(cur, q, localDate());
    const next = rows.map((r) => (r.id === cur.id ? updated : r));
    try {
      await saveCards(cols, next);
      setRows(next); setShow(false); setErr("");
    } catch (e: any) {
      setErr(`Could not save this review on the phone (${e?.message || e}).`);
    }
  }, [cur, rows, cols]);

  const deleteCard = async (id: string) => {
    if (!window.confirm("Kya aap is flashcard ko delete karna chahte hain?")) return;
    const next = rows.filter((r) => r.id !== id);
    try {
      await saveCards(cols, next);
      setRows(next);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e: any) {
      setErr(`Delete fail ho gaya: ${e?.message || e}`);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Selected (${selectedIds.size}) flashcards delete karna chahte hain?`)) return;
    const next = rows.filter((r) => !selectedIds.has(r.id));
    try {
      await saveCards(cols, next);
      setRows(next);
      setSelectedIds(new Set());
    } catch (e: any) {
      setErr(`Bulk delete fail ho gaya: ${e?.message || e}`);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  if (!loaded) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) return <p className={box}>No flashcards on this phone yet. Use Cloud sync first.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <select value={subject} onChange={(e) => { setSubject(e.target.value); setShow(false); }} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            <option value="all">All subjects</option>{subjects.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="text-gray-600">{due.length} due · {rows.length} total</span>
        </div>
        {selectedIds.size > 0 && (
          <button onClick={deleteSelected} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer">
            Delete Selected ({selectedIds.size})
          </button>
        )}
      </div>
      {err && <p className="rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm p-2">{err}</p>}
      {!cur ? <p className={box}>🎉 No cards due{subject !== "all" ? " in this subject" : ""} today.</p> : (
        <div className={`${box} space-y-3 relative`}>
          <div className="flex justify-between items-start">
            <p className="text-xs text-gray-500">{cur.subject} › {cur.topic}</p>
            <div className="flex items-center gap-2">
              <label className="text-xs flex items-center gap-1 cursor-pointer text-gray-600">
                <input type="checkbox" checked={selectedIds.has(cur.id)} onChange={() => toggleSelect(cur.id)} /> Select
              </label>
              <button onClick={() => deleteCard(cur.id)} className="rounded-md bg-red-100 text-red-700 px-2 py-1 text-xs font-semibold cursor-pointer hover:bg-red-200">Delete</button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-base text-gray-900">{cur.front}</p>
          {cur.front_image && <Img path={String(cur.front_image).replace(/^\/api\/screenshots\/file\?p=/, "")} alt="card" />}
          {!show ? (
            <button onClick={() => setShow(true)} className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white cursor-pointer">Show answer</button>
          ) : (
            <>
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 whitespace-pre-wrap text-sm text-gray-900">{cur.back}</div>
              <div className="grid grid-cols-4 gap-2 text-sm font-semibold text-white">
                <button onClick={() => rate(0)} className="rounded-xl bg-red-600 py-3 cursor-pointer">Again</button>
                <button onClick={() => rate(3)} className="rounded-xl bg-amber-600 py-3 cursor-pointer">Hard</button>
                <button onClick={() => rate(4)} className="rounded-xl bg-emerald-600 py-3 cursor-pointer">Good</button>
                <button onClick={() => rate(5)} className="rounded-xl bg-sky-600 py-3 cursor-pointer">Easy</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Errors() {
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [subject, setSubject] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { getTable("error_logs").then((t) => { setRows(t.rows); setLoaded(true); }); }, []);
  const subjects = useMemo(() => Array.from(new Set(rows.map((r) => String(r.subject || "")))).filter(Boolean).sort(), [rows]);
  const list = rows.filter((r) => subject === "all" || r.subject === subject).sort((a, b) => String(b.log_date || "").localeCompare(String(a.log_date || "")));
  if (!loaded) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) return <p className={box}>No error-log entries on this phone yet.</p>;
  const imgs = (r: any): { path?: string; name?: string }[] => { try { const j = JSON.parse(String(r.images || "[]")); return Array.isArray(j) ? j : []; } catch { return []; } };
  const field = (label: string, v: any) => (v ? <p className="text-sm"><b className="text-gray-700">{label}:</b> <span className="whitespace-pre-wrap text-gray-900">{String(v)}</span></p> : null);
  return (
    <div className="space-y-2">
      <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
        <option value="all">All subjects</option>{subjects.map((s) => <option key={s}>{s}</option>)}
      </select>
      {list.map((r) => (
        <div key={r.id} className={box}>
          <button onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full text-left cursor-pointer">
            <p className="text-xs text-gray-500">{r.log_date} · {r.subject}{r.topic ? ` › ${r.topic}` : ""}{Number(r.mastered) ? " · ✅ mastered" : ""}</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-2">{r.question || "(no question text)"}</p>
          </button>
          {open === r.id && (
            <div className="mt-3 space-y-2">
              {field("My answer", r.my_answer)}{field("Correct answer", r.correct_answer)}{field("What went wrong", r.what_went_wrong || r.mistake)}
              {field("Correct concept", r.correct_concept)}{field("Solution", r.solution)}{field("Reason", r.reason)}
              {imgs(r).map((im, i) => im.path ? <Img key={i} path={im.path} alt={im.name || "screenshot"} /> : null)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Pdfs() {
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { 
    getTable("pdfs").then((t) => { 
      setCols(t.columns); 
      setRows(t.rows); 
      setLoaded(true); 
    }); 
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of rows) { const k = `${r.subject} › ${r.chapter}`; m.set(k, [...(m.get(k) || []), r]); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  async function open(r: any, save: boolean) {
    const u = await fileUrl(String(r.relative_path));
    if (!u) { setMsg(`"${r.title}" is not stored on this phone.`); return; }
    setMsg("");
    if (save) { const a = document.createElement("a"); a.href = u; a.download = `${r.title || "notes"}.pdf`; document.body.appendChild(a); a.click(); a.remove(); }
    else window.open(u, "_blank");
  }

  const deletePdf = async (id: string) => {
    if (!window.confirm("Kya aap is PDF ko local library se delete karna chahte hain?")) return;
    const next = rows.filter((r) => r.id !== id);
    try {
      await saveTable("pdfs", cols, next);
      setRows(next);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e: any) {
      setMsg(`Delete fail ho gaya: ${e?.message || e}`);
    }
  };

  const deleteSelectedPdfs = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Selected (${selectedIds.size}) PDFs delete karna chahte hain?`)) return;
    const next = rows.filter((r) => !selectedIds.has(r.id));
    try {
      await saveTable("pdfs", cols, next);
      setRows(next);
      setSelectedIds(new Set());
    } catch (e: any) {
      setMsg(`Bulk delete fail ho gaya: ${e?.message || e}`);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  if (!loaded) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) return <p className={box}>No PDFs on this phone yet.</p>;

  return (
    <div className="space-y-3">
      {msg && <p className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm p-2">{msg}</p>}
      {selectedIds.size > 0 && (
        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
          <span className="text-xs text-gray-600 font-semibold">{selectedIds.size} selected</span>
          <button onClick={deleteSelectedPdfs} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer">
            Delete Selected PDFs
          </button>
        </div>
      )}
      {grouped.map(([g, list]) => (
        <div key={g} className={box}>
          <p className="text-xs font-semibold text-gray-500 mb-2">{g}</p>
          {list.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 border-t first:border-t-0 border-gray-100">
              <div className="flex items-center gap-2 truncate">
                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="cursor-pointer" />
                <span className="text-sm text-gray-900 truncate">{r.title}</span>
              </div>
              <span className="flex gap-1.5 shrink-0">
                <button onClick={() => open(r, false)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer">Open</button>
                <button onClick={() => open(r, true)} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 cursor-pointer">Save</button>
                <button onClick={() => deletePdf(r.id)} className="rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 cursor-pointer hover:bg-red-200">Delete</button>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function OfflineLibrary() {
  const [tab, setTab] = useState<Tab>("cards");
  const [st, setSt] = useState<LocalState | null>(null);
  useEffect(() => { localState().then(setSt).catch(() => {}); }, []);
  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} className={`flex-1 rounded-xl py-2 text-sm font-semibold cursor-pointer ${tab === t ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-700"}`}>{label}</button>
  );
  return (
    <div className="space-y-3 pb-16">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">Offline library</h1>
        <p className="text-xs text-gray-600">{st?.currentBatch ? `Stored on this phone · synced ${new Date(st.lastSync || "").toLocaleString()}` : "Nothing stored yet. Open Cloud sync."} · works without internet</p>
      </div>
      <div className="flex gap-2">{tabBtn("cards", `Flashcards${st ? ` (${st.tables.cards ?? 0})` : ""}`)}{tabBtn("errors", `Errors${st ? ` (${st.tables.error_logs ?? 0})` : ""}`)}{tabBtn("pdfs", `PDFs${st ? ` (${st.tables.pdfs ?? 0})` : ""}`)}</div>
      {tab === "cards" && <Cards />}
      {tab === "errors" && <Errors />}
      {tab === "pdfs" && <Pdfs />}
    </div>
  );
}