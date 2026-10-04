// Safe backup: runs before `npm start`, or manually with `npm run backup`.
//  - local.db  -> timestamped snapshot (VACUUM INTO = consistent even while the app runs, includes the WAL)
//                 and the snapshot is VERIFIED (integrity_check + same row counts as the live database)
//  - pdfs/, screenshots/ -> ONE mirrored copy; a file is (re)copied when it is new OR its size/modified-time changed
//  - keeps the newest 30 DB snapshots; never deletes anything else in the backup folder
//  - writes <BACKUP_DIR>/backup-status.json so the app can SHOW whether the last backup worked (no terminal needed)
//  - the app still starts if the backup fails (you can still study), but the failure is loud: red banner in the app + exit message
import { createClient } from "@libsql/client";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, statfsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Plain `node` does not read .env.local, so read the two settings we need ourselves.
function readEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return out;
}
const env = { ...readEnvFile(path.join(root, ".env.local")), ...process.env };
const dataDir = env.DATA_DIR ? path.resolve(env.DATA_DIR) : root;
const backupRoot = env.BACKUP_DIR ? path.resolve(env.BACKUP_DIR) : path.join(dataDir, "backups");
const dbFile = path.join(dataDir, "local.db");
const statusFile = path.join(backupRoot, "backup-status.json");

function writeStatus(s) {
  try {
    mkdirSync(backupRoot, { recursive: true });
    const tmp = `${statusFile}.tmp`;
    writeFileSync(tmp, JSON.stringify({ ...s, at: new Date().toISOString() }, null, 2));
    renameSync(tmp, statusFile);
  } catch (e) {
    console.warn("Could not write backup-status.json:", e?.message || e);
  }
}

/** Mirror src -> dst. Copies when the file is missing or differs in size / is newer. Never deletes. Returns {copied, failed}. */
function mirror(src, dst, acc = { copied: 0, failed: [] }) {
  if (!existsSync(src)) return acc;
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (e.name === "_trash") continue; // deleted PDFs are intentionally not mirrored
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      mirror(s, d, acc);
      continue;
    }
    if (!e.isFile()) continue;
    try {
      const a = statSync(s);
      const b = existsSync(d) ? statSync(d) : null;
      if (!b || b.size !== a.size || a.mtimeMs > b.mtimeMs + 2000) {
        const tmp = `${d}.copying`;
        copyFileSync(s, tmp);
        if (statSync(tmp).size !== a.size) throw new Error("size mismatch after copy");
        renameSync(tmp, d);
        acc.copied++;
      }
    } catch (err) {
      acc.failed.push(`${s}: ${err?.message || err}`);
    }
  }
  return acc;
}

const TABLES_TO_COUNT = ["cards", "error_logs", "syllabus_progress", "pdfs", "pdf_annotations", "pdf_bookmarks", "todo_list", "mock_tests", "study_links"];

async function counts(client) {
  const out = {};
  for (const t of TABLES_TO_COUNT) {
    try {
      const r = await client.execute(`SELECT COUNT(*) AS n FROM "${t}"`);
      out[t] = Number(r.rows[0].n);
    } catch {
      out[t] = null; // table does not exist (yet)
    }
  }
  return out;
}

try {
  if (!existsSync(dbFile)) {
    console.log("Backup skipped: no local.db yet.");
    writeStatus({ ok: true, skipped: true, note: "no local.db yet", dataDir, backupRoot });
    process.exit(0);
  }
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  // includes seconds -> two starts in the same minute no longer collide
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

  const dbDir = path.join(backupRoot, "db");
  mkdirSync(dbDir, { recursive: true });
  const dest = path.join(dbDir, `local-${stamp}.db`);

  const live = createClient({ url: `file:${dbFile}` });
  await live.execute(`VACUUM INTO '${dest.replace(/\\/g, "/").replace(/'/g, "''")}'`);
  const liveCounts = await counts(live);
  live.close();

  // VERIFY the snapshot: it must open, pass integrity_check and hold the same rows
  const snap = createClient({ url: `file:${dest}` });
  const ic = await snap.execute("PRAGMA integrity_check");
  const icOk = ic.rows.length === 1 && String(Object.values(ic.rows[0])[0]) === "ok";
  const snapCounts = await counts(snap);
  snap.close();
  if (!icOk) throw new Error("snapshot failed PRAGMA integrity_check");
  // the app may legitimately write a row between the two reads, so only a snapshot with FEWER rows than live is an error
  const missing = Object.keys(liveCounts).filter((t) => liveCounts[t] !== null && (snapCounts[t] ?? -1) < liveCounts[t] - 1);
  if (missing.length) throw new Error(`snapshot has fewer rows than the live database in: ${missing.join(", ")}`);

  const pdfs = mirror(path.join(dataDir, "pdfs"), path.join(backupRoot, "pdfs"));
  const shots = mirror(path.join(dataDir, "screenshots"), path.join(backupRoot, "screenshots"));
  const failedFiles = [...pdfs.failed, ...shots.failed];

  // keep only the newest 30 automatic snapshots; pre-migration / pre-restore copies are kept separately (newest 10)
  const snaps = readdirSync(dbDir).filter((f) => /^local-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const old of snaps.slice(0, Math.max(0, snaps.length - 30))) rmSync(path.join(dbDir, old), { force: true });
  const safety = readdirSync(dbDir).filter((f) => /^pre-(migration|restore)-.*\.db$/.test(f)).sort();
  for (const old of safety.slice(0, Math.max(0, safety.length - 10))) rmSync(path.join(dbDir, old), { force: true });

  let freeGB = null;
  try {
    const st = statfsSync(backupRoot);
    freeGB = Math.round((Number(st.bavail) * Number(st.bsize)) / 1e8) / 10;
  } catch {}

  const ok = failedFiles.length === 0;
  writeStatus({
    ok,
    snapshot: dest,
    rows: snapCounts,
    pdfFilesCopied: pdfs.copied,
    screenshotFilesCopied: shots.copied,
    failedFiles: failedFiles.slice(0, 20),
    failedFileCount: failedFiles.length,
    backupDiskFreeGB: freeGB,
    sameDriveAsData: path.parse(backupRoot).root.toLowerCase() === path.parse(dataDir).root.toLowerCase(),
    dataDir,
    backupRoot,
  });
  if (ok) console.log("Backup done and verified:", dest);
  else console.warn(`Backup finished with ${failedFiles.length} FILE ERRORS (database snapshot is fine). First: ${failedFiles[0]}`);
} catch (err) {
  const msg = err?.message || String(err);
  writeStatus({ ok: false, error: msg, dataDir, backupRoot });
  console.warn("\n==============================================================");
  console.warn(" BACKUP FAILED - your study data is NOT backed up right now.");
  console.warn(" Reason:", msg);
  console.warn(" The app will still start. A red warning is shown inside the app.");
  console.warn("==============================================================\n");
}
process.exit(0);
