// Pure helpers shared by the sync API route and the browser code. No imports from Next/React/Supabase,
// so they can be unit-tested with plain Node (see tests/).

export const SYNC_BUCKET_DEFAULT = "gate-sync";
export const SYNC_FORMAT = "gate-sync";
/** Free Supabase plan: one object can be at most 50 MB. */
export const MAX_OBJECT_BYTES = 50 * 1024 * 1024;

export type SyncFile = {
  /** original path inside the backup zip, e.g. "pdfs/C Programming/Ch 1/a.pdf" or "tables/cards.json" */
  path: string;
  /** storage object key inside the bucket (ASCII only), e.g. "b_20261004/f/0007" */
  key: string;
  size: number;
  sha256: string;
};

export type SyncManifest = {
  format: typeof SYNC_FORMAT;
  batchId: string;
  createdAt: string;
  /** manifest.json of the offline dashboard's backup zip (row counts etc.) */
  backup: any;
  files: SyncFile[];
  totalBytes: number;
};

export type Ack = { batchId: string; deviceId: string; deviceName: string; at: string; ok: boolean; files: number; bytes: number };

export const BATCH_RE = /^b_[0-9]{8}T[0-9]{6}_[a-z0-9]{4,8}$/;
export const DEVICE_RE = /^[A-Za-z0-9_-]{6,64}$/;

export function newBatchId(now = new Date(), rand = Math.random().toString(36).slice(2, 8)): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `b_${stamp}_${rand.replace(/[^a-z0-9]/g, "").slice(0, 8).padEnd(4, "0")}`;
}

/** Storage keys never contain the original (unicode/space-heavy) file name: "<batch>/f/0007". */
export function objectKey(batchId: string, index: number): string {
  return `${batchId}/f/${String(index).padStart(5, "0")}`;
}

/** A zip entry we are willing to carry: no traversal, only the three known areas. */
export function entryPathOk(p: string): boolean {
  if (typeof p !== "string" || p.length === 0 || p.length > 400) return false;
  if (p.includes("..") || p.startsWith("/") || p.includes("\\") || p.includes("\0")) return false;
  return p === "manifest.json" || /^tables\/[A-Za-z0-9_]+\.json$/.test(p) || p.startsWith("pdfs/") || p.startsWith("screenshots/");
}

/** Validates a manifest sent by the browser. Returns an error text or null. */
export function validateManifest(m: any): string | null {
  if (!m || m.format !== SYNC_FORMAT) return "not a gate-sync manifest";
  if (typeof m.batchId !== "string" || !BATCH_RE.test(m.batchId)) return "bad batchId";
  if (!Array.isArray(m.files) || m.files.length === 0) return "manifest has no files";
  if (m.files.length > 20000) return "too many files";
  const seenPath = new Set<string>();
  const seenKey = new Set<string>();
  let total = 0;
  m.files.forEach((f: any, i: number) => {
    if (total < 0) return;
    if (!f || !entryPathOk(f.path)) { total = -1; return; }
    if (f.key !== objectKey(m.batchId, i)) { total = -2; return; }
    if (!Number.isInteger(f.size) || f.size < 0 || f.size > MAX_OBJECT_BYTES) { total = -3; return; }
    if (typeof f.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(f.sha256)) { total = -4; return; }
    if (seenPath.has(f.path) || seenKey.has(f.key)) { total = -5; return; }
    seenPath.add(f.path); seenKey.add(f.key); total += f.size;
  });
  if (total === -1) return "a file path is not allowed";
  if (total === -2) return "a storage key does not match its position";
  if (total === -3) return `a file is larger than ${MAX_OBJECT_BYTES / 1048576} MB (the free Supabase storage limit per file)`;
  if (total === -4) return "a file has no valid sha256";
  if (total === -5) return "duplicate file in manifest";
  return null;
}

/** Compares what the manifest promises with what is really in storage. Returns the list of problems (empty = all there). */
export function diffAgainstListing(files: SyncFile[], listing: Map<string, number>): string[] {
  const problems: string[] = [];
  for (const f of files) {
    const got = listing.get(f.key);
    if (got === undefined) problems.push(`missing in cloud: ${f.path}`);
    else if (got !== f.size) problems.push(`size differs (${got} vs ${f.size}): ${f.path}`);
  }
  return problems;
}

/** Constant-time comparison of the passphrase (hash both sides first so lengths never leak). */
export async function keysEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

/** Local calendar date YYYY-MM-DD (India), never UTC. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

/** SM-2, identical to the offline dashboard (lib/srs.ts), so a card reviewed on the phone behaves exactly as on the laptop. */
export type SrsCard = { ease: number; interval: number; reps: number; lapses: number; due: string; last_reviewed: string };
export type Rating = 0 | 3 | 4 | 5;
export function reviewCard<T extends SrsCard>(card: T, q: Rating, today: string = localDate()): T {
  let reps = Number(card.reps) || 0, interval = Number(card.interval) || 0, ease = Number(card.ease) || 2.5, lapses = Number(card.lapses) || 0;
  if (q < 3) { reps = 0; interval = 1; lapses += 1; }
  else { reps += 1; interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(Math.max(interval, 1) * ease); }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  interval = Math.max(1, interval);
  return { ...card, reps, interval, ease, lapses, due: addDays(today, interval), last_reviewed: today };
}

/**
 * Cards: when the cloud copy is synced onto a phone that already has newer reviews, keep the phone's card.
 * Everything else comes from the incoming backup. Rows are matched by id.
 */
export function mergeCards(local: any[], incoming: any[]): { rows: any[]; keptLocal: number } {
  const loc = new Map(local.map((r) => [String(r.id), r]));
  let keptLocal = 0;
  const rows = incoming.map((r) => {
    const l = loc.get(String(r.id));
    if (l && String(l.last_reviewed || "") > String(r.last_reviewed || "")) { keptLocal++; return l; }
    return r;
  });
  return { rows, keptLocal };
}
