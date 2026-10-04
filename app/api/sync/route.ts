import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  SYNC_BUCKET_DEFAULT, BATCH_RE, DEVICE_RE, MAX_OBJECT_BYTES,
  keysEqual, validateManifest, diffAgainstListing, objectKey,
  type SyncManifest, type Ack,
} from "@/lib/sync/core";

// Cloud "bridge" between the offline dashboard (laptop) and the phone.
//   laptop  --upload-->  Supabase Storage (private bucket)  --download-->  phone (IndexedDB)  --clean-->  cloud is empty again
// Big files NEVER pass through this route (Vercel limits request bodies to ~4.5 MB): this route only hands out short-lived
// signed upload/download URLs and keeps the manifest. Every call needs the passphrase in the x-sync-key header.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = process.env.SYNC_BUCKET || SYNC_BUCKET_DEFAULT;
const SIGNED_TTL = 60 * 60; // 1 hour

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL are not set in the Vercel project.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function requireKey(req: NextRequest) {
  const expected = process.env.SYNC_ACCESS_KEY;
  if (!expected || expected.length < 8) {
    throw new HttpError(503, "SYNC_ACCESS_KEY is not set (min 8 characters). Add it in Vercel -> Project -> Settings -> Environment Variables, then redeploy.");
  }
  const given = req.headers.get("x-sync-key") || "";
  if (!(await keysEqual(given, expected))) throw new HttpError(401, "Wrong sync passphrase.");
}

async function ensureBucket(sb: SupabaseClient) {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await sb.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new HttpError(500, `Could not create bucket "${BUCKET}": ${error.message}`);
}

/** Lists every object under a prefix (storage.list is not recursive and is paged). Returns key -> size. */
async function listAll(sb: SupabaseClient, prefix: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const folders = [prefix.replace(/\/$/, "")];
  while (folders.length) {
    const folder = folders.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await sb.storage.from(BUCKET).list(folder, { limit: 1000, offset });
      if (error) throw new HttpError(500, `Cloud listing failed: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const it of data as any[]) {
        const full = folder ? `${folder}/${it.name}` : it.name;
        if (it.id === null || it.id === undefined) folders.push(full); // a "folder" entry
        else out.set(full, Number(it.metadata?.size ?? 0));
      }
      if (data.length < 1000) break;
    }
  }
  return out;
}

async function readJson<T>(sb: SupabaseClient, key: string): Promise<T | null> {
  const { data, error } = await sb.storage.from(BUCKET).download(key);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()) as T; } catch { return null; }
}

async function writeJson(sb: SupabaseClient, key: string, value: unknown) {
  const body = new Blob([JSON.stringify(value)], { type: "application/json" });
  const { error } = await sb.storage.from(BUCKET).upload(key, body, { upsert: true, contentType: "application/json" });
  if (error) throw new HttpError(500, `Could not write ${key}: ${error.message}`);
}

async function removeAll(sb: SupabaseClient, keys: string[]) {
  for (let i = 0; i < keys.length; i += 100) {
    const { error } = await sb.storage.from(BUCKET).remove(keys.slice(i, i + 100));
    if (error) throw new HttpError(500, `Cloud delete failed: ${error.message}`);
  }
}

const needBatch = (b: any) => { if (typeof b !== "string" || !BATCH_RE.test(b)) throw new HttpError(400, "bad batchId"); return b; };

export async function POST(req: NextRequest) {
  try {
    await requireKey(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const sb = admin();

    /* ---- "ping": just checks passphrase + server config (used by the Connect button) ---- */
    if (action === "ping") {
      await ensureBucket(sb);
      return NextResponse.json({ ok: true, bucket: BUCKET, maxObjectMB: MAX_OBJECT_BYTES / 1048576 });
    }

    /* ---- laptop: ask for upload URLs for the files of a new batch ---- */
    if (action === "sign-upload") {
      await ensureBucket(sb);
      const batchId = needBatch(body.batchId);
      const count = Number(body.count);
      const from = Number(body.from) || 0;
      if (!Number.isInteger(count) || count < 1 || count > 50 || from < 0 || from > 20000) throw new HttpError(400, "bad count/from");
      const items: { index: number; key: string; token: string; signedUrl: string }[] = [];
      for (let i = from; i < from + count; i++) {
        const key = objectKey(batchId, i);
        const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(key);
        if (error || !data) throw new HttpError(500, `Could not create upload URL: ${error?.message}`);
        items.push({ index: i, key, token: data.token, signedUrl: data.signedUrl });
      }
      return NextResponse.json({ ok: true, bucket: BUCKET, items });
    }

    /* ---- laptop: all files uploaded -> verify them in storage, then publish the manifest ---- */
    if (action === "commit") {
      const m = body.manifest as SyncManifest;
      const bad = validateManifest(m);
      if (bad) throw new HttpError(400, `Invalid manifest: ${bad}`);
      const listing = await listAll(sb, `${m.batchId}/f`);
      const problems = diffAgainstListing(m.files, listing);
      if (problems.length) throw new HttpError(409, `Upload is incomplete, nothing was published. ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? ` (+${problems.length - 5} more)` : ""}`);
      await writeJson(sb, `${m.batchId}/manifest.json`, m);
      await writeJson(sb, `latest.json`, { batchId: m.batchId, createdAt: m.createdAt });
      return NextResponse.json({ ok: true, batchId: m.batchId, files: m.files.length, bytes: m.totalBytes });
    }

    /* ---- anyone with the passphrase: what is in the cloud right now? ---- */
    if (action === "status") {
      await ensureBucket(sb);
      const latest = await readJson<{ batchId: string }>(sb, "latest.json");
      if (!latest || !BATCH_RE.test(latest.batchId)) return NextResponse.json({ ok: true, latest: null, acks: [], cloudBytes: 0, cloudFiles: 0 });
      const manifest = await readJson<SyncManifest>(sb, `${latest.batchId}/manifest.json`);
      const all = await listAll(sb, latest.batchId);
      let bytes = 0; all.forEach((s) => (bytes += s));
      const acks: Ack[] = [];
      for (const k of all.keys()) if (k.startsWith(`${latest.batchId}/ack/`)) { const a = await readJson<Ack>(sb, k); if (a) acks.push(a); }
      return NextResponse.json({ ok: true, latest: manifest, acks, cloudBytes: bytes, cloudFiles: all.size });
    }

    /* ---- phone: signed download URLs for some files of a batch ---- */
    if (action === "sign-download") {
      const batchId = needBatch(body.batchId);
      const keys: string[] = Array.isArray(body.keys) ? body.keys : [];
      if (keys.length < 1 || keys.length > 50) throw new HttpError(400, "1-50 keys per call");
      for (const k of keys) if (typeof k !== "string" || !k.startsWith(`${batchId}/f/`) || k.includes("..")) throw new HttpError(400, "bad key");
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(keys, SIGNED_TTL);
      if (error || !data) throw new HttpError(500, `Could not create download URLs: ${error?.message}`);
      return NextResponse.json({ ok: true, urls: data.map((d: any) => ({ key: d.path, url: d.signedUrl, error: d.error || null })) });
    }

    /* ---- phone: "I downloaded and VERIFIED everything" ---- */
    if (action === "ack") {
      const batchId = needBatch(body.batchId);
      const deviceId = String(body.deviceId || "");
      if (!DEVICE_RE.test(deviceId)) throw new HttpError(400, "bad deviceId");
      const ack: Ack = {
        batchId, deviceId, deviceName: String(body.deviceName || "device").slice(0, 80), at: new Date().toISOString(),
        ok: body.ok === true, files: Number(body.files) || 0, bytes: Number(body.bytes) || 0,
      };
      await writeJson(sb, `${batchId}/ack/${deviceId}.json`, ack);
      return NextResponse.json({ ok: true });
    }

    /* ---- clean the cloud (delete the batch). Needs at least one verified phone download, unless force ---- */
    if (action === "clean") {
      const batchId = needBatch(body.batchId);
      const all = await listAll(sb, batchId);
      if (body.force !== true) {
        let verified = 0;
        for (const k of all.keys()) if (k.startsWith(`${batchId}/ack/`)) { const a = await readJson<Ack>(sb, k); if (a?.ok && a.batchId === batchId) verified++; }
        if (verified === 0) throw new HttpError(409, "No phone has confirmed a verified download of this batch yet, so the cloud copy was NOT deleted. Download it on the phone first (or tick 'delete anyway').");
      }
      await removeAll(sb, [...all.keys()]);
      const latest = await readJson<{ batchId: string }>(sb, "latest.json");
      if (latest?.batchId === batchId) await removeAll(sb, ["latest.json"]);
      const left = await listAll(sb, batchId);
      return NextResponse.json({ ok: true, deleted: all.size, remaining: left.size });
    }

    throw new HttpError(400, "unknown action");
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("sync error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
