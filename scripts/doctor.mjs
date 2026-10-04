// `npm run doctor` - read-only health check of your study data. It never changes anything.
//   DATABASE / FOREIGN KEYS / SCHEMA / PDF FILES / SCREENSHOTS / FLASHCARD IMAGES / JSON / DATES / SRS / BACKUP / DISK
// Exit code 0 = no FAIL, 1 = at least one FAIL (warnings do not fail).
import { existsSync, readFileSync, readdirSync, statSync, statfsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const results = []; // {area, level: OK|WARN|FAIL, msg}
const add = (area, level, msg) => results.push({ area, level, msg });

/** Opens the database READ-ONLY-ish: @libsql/client if installed, else node:sqlite (Node >= 22.5). */
async function openDb(file) {
  try {
    const { createClient } = await import("@libsql/client");
    const c = createClient({ url: `file:${file}` });
    return {
      all: async (sql, args = []) => (await c.execute({ sql, args })).rows.map((r) => ({ ...r })),
      close: () => c.close(),
      engine: "libsql",
    };
  } catch {
    const { DatabaseSync } = await import("node:sqlite");
    const d = new DatabaseSync(file);
    return { all: async (sql, args = []) => d.prepare(sql).all(...args), close: () => d.close(), engine: "node:sqlite" };
  }
}

const REQUIRED = {
  cards: ["id", "front", "back", "subject", "topic", "ease", "interval", "reps", "lapses", "due", "topic_id"],
  error_logs: ["id", "topic", "images", "mastered", "review_count", "last_reviewed", "topic_id"],
  pdfs: ["id", "relative_path", "file_size", "topic_id"],
  pdf_annotations: ["key", "pdf_id", "page", "items_json"], // the OLD layout (id/page_number/data_json) makes every annotation save fail
  pdf_bookmarks: ["id", "pdf_id", "page", "label"],
  syllabus_progress: ["id", "user_id", "topic_key", "completed"],
  todo_list: ["date", "task", "completed"],
  mock_tests: ["id", "test_date", "subject", "score", "max_score"],
  mock_test_sections: ["test_id", "name", "marks"],
  mock_test_topic_loss: ["test_id", "topic_id", "marks_lost"],
  study_sessions: ["id", "date", "duration_sec", "kind"],
  daily_plan_items: ["date", "topic_id"],
  reviews: ["date", "count"],
  study_links: ["id", "title", "url"],
  roadmap_schedule: ["id", "data"],
  app_meta: ["key", "value"],
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s) => {
  if (!DATE_RE.test(String(s))) return false;
  const [y, m, d] = String(s).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const isJson = (s) => {
  try {
    JSON.parse(String(s));
    return true;
  } catch {
    return false;
  }
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "_trash") continue;
      walk(p, out);
    } else if (e.isFile()) out.push(p);
  }
  return out;
}
const rel = (abs) => path.relative(dataDir, abs).replace(/\\/g, "/");

async function main() {
  // ---- environment / directories
  add("ENVIRONMENT", existsSync(path.join(root, ".env.local")) ? "OK" : "WARN", existsSync(path.join(root, ".env.local")) ? `DATA_DIR = ${dataDir}` : `.env.local missing: using the project folder (${dataDir}) for ALL data. Re-extracting a new zip could overwrite it.`);
  if (!env.DATA_DIR) add("ENVIRONMENT", "WARN", "DATA_DIR is not set: your database/PDFs live inside the code folder.");
  if (!existsSync(dataDir)) {
    add("ENVIRONMENT", "FAIL", `Data folder does not exist: ${dataDir}. The app would start with an EMPTY database there.`);
    return;
  }
  if (!existsSync(dbFile)) {
    add("DATABASE", "FAIL", `No database at ${dbFile}. If you expected your old data, DATA_DIR in .env.local points to the wrong folder.`);
    return;
  }

  const db = await openDb(dbFile);
  try {
    add("DATABASE", "OK", `opened ${dbFile} (${(statSync(dbFile).size / 1e6).toFixed(1)} MB, engine ${db.engine})`);
    const ic = await db.all("PRAGMA integrity_check");
    const icv = ic.map((r) => String(Object.values(r)[0]));
    add("DATABASE", icv.length === 1 && icv[0] === "ok" ? "OK" : "FAIL", icv.length === 1 && icv[0] === "ok" ? "PRAGMA integrity_check = ok" : `integrity_check: ${icv.slice(0, 5).join("; ")}`);
    const fk = await db.all("PRAGMA foreign_key_check");
    add("FOREIGN KEYS", fk.length === 0 ? "OK" : "FAIL", fk.length === 0 ? "no orphaned child rows" : `${fk.length} orphaned rows, e.g. table ${fk[0].table} rowid ${fk[0].rowid}`);
    const jm = await db.all("PRAGMA journal_mode");
    add("DATABASE", String(Object.values(jm[0])[0]).toLowerCase() === "wal" ? "OK" : "WARN", `journal_mode = ${Object.values(jm[0])[0]}`);
    if (existsSync(`${dbFile}-wal`)) add("DATABASE", "OK", `WAL file present (${(statSync(`${dbFile}-wal`).size / 1e6).toFixed(1)} MB). When copying the database by hand copy local.db, local.db-wal AND local.db-shm together (or use the backup).`);

    // ---- schema
    const tables = new Set((await db.all("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => String(r.name)));
    const metaV = tables.has("app_meta") ? await db.all("SELECT value FROM app_meta WHERE key='schema_version'") : [];
    const ver = metaV.length ? Number(metaV[0].value) : 0;
    const LATEST = 8;
    add("MIGRATION", ver >= LATEST ? "OK" : "WARN", ver >= LATEST ? `schema_version ${ver}` : `schema_version ${ver} (latest is ${LATEST}). Start the app once (npm start): it migrates automatically and takes a snapshot first.`);
    let schemaOk = true;
    for (const [t, cols] of Object.entries(REQUIRED)) {
      if (!tables.has(t)) {
        if (ver >= LATEST) {
          add("SCHEMA", "FAIL", `table ${t} is missing`);
          schemaOk = false;
        }
        continue;
      }
      const have = new Set((await db.all(`PRAGMA table_info("${t}")`)).map((r) => String(r.name)));
      const miss = cols.filter((c) => !have.has(c));
      if (miss.length) {
        add("SCHEMA", t === "pdf_annotations" ? "FAIL" : ver >= LATEST ? "FAIL" : "WARN", `table ${t} lacks column(s): ${miss.join(", ")}${t === "pdf_annotations" ? "  <- ANNOTATION SAVES FAIL on this layout. Start the app once: migration 8 repairs it without losing data." : ""}`);
        schemaOk = false;
      }
    }
    if (schemaOk) add("SCHEMA", "OK", "all required tables/columns present");
    const idx = (await db.all("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")).map((r) => String(r.name));
    add("SCHEMA", "OK", `${idx.length} explicit index(es)${idx.length === 0 ? " (fine for months of personal data; add indexes only if a page becomes slow)" : ""}`);

    // ---- row counts
    const counts = [];
    for (const t of tables) {
      if (t.startsWith("sqlite_")) continue;
      counts.push(`${t}=${(await db.all(`SELECT COUNT(*) AS n FROM "${t}"`))[0].n}`);
    }
    add("DATABASE", "OK", `rows: ${counts.join(", ")}`);
    const leftovers = [...tables].filter((t) => /_old_\d+$|_backup$|_new$/.test(t));
    if (leftovers.length) add("SCHEMA", "WARN", `leftover legacy table(s) kept from a migration: ${leftovers.join(", ")} (safe to keep; they are your pre-migration copy)`);

    // ---- PDF files <-> database
    if (tables.has("pdfs")) {
      const rows = await db.all("SELECT id, relative_path, file_size FROM pdfs");
      const known = new Set();
      let missing = 0, sizeDiff = 0, badPath = 0;
      const missingList = [];
      for (const r of rows) {
        const relp = String(r.relative_path).replace(/\\/g, "/");
        if (!/^pdfs\//i.test(relp) || relp.includes("..")) {
          badPath++;
          continue;
        }
        const abs = path.resolve(dataDir, relp);
        known.add(abs.toLowerCase());
        if (!existsSync(abs)) {
          missing++;
          if (missingList.length < 5) missingList.push(relp);
          continue;
        }
        if (Number(r.file_size) && statSync(abs).size !== Number(r.file_size)) sizeDiff++;
        try {
          const fd = readFileSync(abs, { encoding: null, flag: "r" }).subarray(0, 5).toString("latin1");
          if (fd !== "%PDF-") add("PDF FILES", "FAIL", `not a PDF (bad header): ${relp}`);
        } catch (e) {
          add("PDF FILES", "FAIL", `unreadable: ${relp} (${e.message})`);
        }
      }
      const onDisk = walk(path.join(dataDir, "pdfs"));
      const orphanFiles = onDisk.filter((f) => !known.has(path.resolve(f).toLowerCase()));
      add("PDF FILES", missing === 0 && badPath === 0 ? "OK" : "FAIL", missing === 0 && badPath === 0 ? `${rows.length} database record(s), every file exists` : `${missing} record(s) point to a MISSING file${missingList.length ? ": " + missingList.join("; ") : ""}; ${badPath} with an invalid path`);
      if (sizeDiff) add("PDF FILES", "WARN", `${sizeDiff} file(s) differ in size from the recorded size`);
      add("PDF FILES", orphanFiles.length === 0 ? "OK" : "WARN", orphanFiles.length === 0 ? "no orphan PDF files" : `${orphanFiles.length} PDF file(s) on disk have no database record (e.g. a failed upload): ${orphanFiles.slice(0, 3).map(rel).join("; ")}`);
    }

    // ---- screenshots + flashcard images
    const shotsKnown = new Set();
    const refMissing = [];
    const noteRef = (p) => {
      const relp = String(p || "").replace(/\\/g, "/");
      if (!/^screenshots\//i.test(relp) || relp.includes("..")) return;
      const abs = path.resolve(dataDir, relp);
      shotsKnown.add(abs.toLowerCase());
      if (!existsSync(abs)) refMissing.push(relp);
    };
    if (tables.has("error_logs")) {
      let bad = 0, base64 = 0;
      for (const r of await db.all("SELECT id, images FROM error_logs WHERE images IS NOT NULL AND images != ''")) {
        if (!isJson(r.images)) {
          bad++;
          continue;
        }
        for (const it of JSON.parse(String(r.images))) {
          if (it && typeof it === "object" && it.path) noteRef(it.path);
          else if (typeof it === "string" || (it && String(it.dataUrl || "").startsWith("data:"))) base64++;
        }
      }
      add("SCREENSHOTS", bad === 0 ? "OK" : "FAIL", bad === 0 ? "error-log image lists are valid JSON" : `${bad} error log(s) have unreadable image JSON`);
      if (base64) add("SCREENSHOTS", "WARN", `${base64} screenshot(s) are still base64 inside the database (the app moves them to files on start)`);
    }
    if (tables.has("cards")) {
      for (const r of await db.all("SELECT front_image FROM cards WHERE front_image IS NOT NULL AND front_image != ''")) noteRef(r.front_image);
    }
    add("SCREENSHOTS", refMissing.length === 0 ? "OK" : "FAIL", refMissing.length === 0 ? "every referenced screenshot / card image exists" : `${refMissing.length} referenced image file(s) are MISSING, e.g. ${refMissing.slice(0, 3).join("; ")}`);
    const shotFiles = walk(path.join(dataDir, "screenshots"));
    const orphanShots = shotFiles.filter((f) => !shotsKnown.has(path.resolve(f).toLowerCase()));
    add("FLASHCARD IMAGES", orphanShots.length === 0 ? "OK" : "WARN", orphanShots.length === 0 ? "no orphan image files" : `${orphanShots.length} image file(s) on disk are not referenced by any record (harmless leftovers): ${orphanShots.slice(0, 3).map(rel).join("; ")}`);

    // ---- JSON / dates / SRS / numbers
    const bad = [];
    const check = async (label, sql, test) => {
      try {
        const rows = await db.all(sql);
        const n = rows.filter(test).length;
        if (n) bad.push(`${label}: ${n}`);
      } catch {
        /* table or column not there yet */
      }
    };
    await check("cards.source_json invalid JSON", "SELECT source_json AS v FROM cards WHERE source_json IS NOT NULL AND source_json != ''", (r) => !isJson(r.v));
    await check("pdf_annotations.items_json invalid JSON", "SELECT items_json AS v FROM pdf_annotations", (r) => !isJson(r.v));
    await check("roadmap_schedule.data invalid JSON", "SELECT data AS v FROM roadmap_schedule", (r) => !isJson(r.v));
    await check("cards.due not a valid date", "SELECT due AS v FROM cards", (r) => !validDate(r.v));
    await check("todo_list.date not a valid date", "SELECT date AS v FROM todo_list", (r) => !validDate(r.v));
    await check("mock_tests.test_date not a valid date", "SELECT test_date AS v FROM mock_tests", (r) => !validDate(r.v));
    await check("study_sessions.date not a valid date", "SELECT date AS v FROM study_sessions", (r) => !validDate(r.v));
    await check("error_logs.log_date not a valid date", "SELECT log_date AS v FROM error_logs WHERE log_date IS NOT NULL AND log_date != ''", (r) => !validDate(r.v));
    await check("cards with impossible SRS values", "SELECT ease, interval, reps, lapses FROM cards", (r) => !(Number(r.ease) >= 1.3 && Number(r.interval) >= 0 && Number(r.reps) >= 0 && Number(r.lapses) >= 0));
    await check("study_sessions with duration <= 0", "SELECT duration_sec AS v FROM study_sessions", (r) => !(Number(r.v) > 0));
    await check("mock_tests with max_score <= 0 or score > max_score", "SELECT score, max_score FROM mock_tests", (r) => !(Number(r.max_score) > 0 && Number(r.score) <= Number(r.max_score)));
    await check("error_logs with empty topic_id", "SELECT topic_id AS v FROM error_logs", (r) => !r.v);
    await check("cards with empty topic_id", "SELECT topic_id AS v FROM cards", (r) => !r.v);
    add("DATA VALUES", bad.length === 0 ? "OK" : "WARN", bad.length === 0 ? "JSON, dates, SRS values and scores are all valid" : bad.join("; "));
    const dup = await db.all("SELECT topic_key, COUNT(*) AS n FROM syllabus_progress GROUP BY user_id, topic_key HAVING n > 1").catch(() => []);
    add("SYLLABUS", dup.length === 0 ? "OK" : "WARN", dup.length === 0 ? "no duplicate progress rows" : `${dup.length} topic(s) have duplicate progress rows`);
  } finally {
    db.close();
  }

  // ---- backup
  const statusFile = path.join(backupRoot, "backup-status.json");
  if (!existsSync(backupRoot)) add("BACKUP", "FAIL", `backup folder does not exist: ${backupRoot}`);
  else if (!existsSync(statusFile)) add("BACKUP", "WARN", "no backup-status.json yet: run `npm run backup` once");
  else {
    const st = JSON.parse(readFileSync(statusFile, "utf8"));
    const ageH = (Date.now() - new Date(st.at).getTime()) / 3600000;
    add("BACKUP", st.ok ? (ageH <= 36 ? "OK" : "WARN") : "FAIL", st.ok ? `last verified backup: ${new Date(st.at).toLocaleString()} (${Math.round(ageH)} h ago)` : `last backup FAILED: ${st.error || st.failedFileCount + " file errors"}`);
    if (st.sameDriveAsData) add("BACKUP", "WARN", "backup is on the SAME drive as your data: a dead disk loses both. Copy BACKUP_DIR to another disk / cloud regularly.");
    const snaps = existsSync(path.join(backupRoot, "db")) ? readdirSync(path.join(backupRoot, "db")).filter((f) => /^local-.*\.db$/.test(f)) : [];
    add("BACKUP", snaps.length ? "OK" : "FAIL", `${snaps.length} database snapshot(s) in ${path.join(backupRoot, "db")}`);
  }

  // ---- disk space
  for (const [label, dir] of [["data", dataDir], ["backup", backupRoot]]) {
    try {
      const s = statfsSync(existsSync(dir) ? dir : path.dirname(dir));
      const gb = (Number(s.bavail) * Number(s.bsize)) / 1e9;
      add("DISK", gb < 1 ? "FAIL" : gb < 5 ? "WARN" : "OK", `${label} drive free space: ${gb.toFixed(1)} GB`);
    } catch {
      add("DISK", "WARN", `could not read free space for ${label} drive`);
    }
  }
}

try {
  await main();
} catch (e) {
  add("DOCTOR", "FAIL", `doctor itself crashed: ${e?.message || e}`);
}

const order = ["ENVIRONMENT", "DATABASE", "FOREIGN KEYS", "SCHEMA", "MIGRATION", "PDF FILES", "SCREENSHOTS", "FLASHCARD IMAGES", "DATA VALUES", "SYLLABUS", "BACKUP", "DISK", "DOCTOR"];
const worst = (a) => (a.some((x) => x.level === "FAIL") ? "FAIL" : a.some((x) => x.level === "WARN") ? "WARN" : "OK");
console.log("\nGATE 2027 DASHBOARD - DOCTOR\n");
for (const area of order) {
  const r = results.filter((x) => x.area === area);
  if (!r.length) continue;
  console.log(`${(area + ":").padEnd(20)}${worst(r)}`);
  for (const x of r) if (x.level !== "OK" || process.argv.includes("--verbose")) console.log(`    [${x.level}] ${x.msg}`);
}
const fails = results.filter((x) => x.level === "FAIL").length;
const warns = results.filter((x) => x.level === "WARN").length;
console.log(`\nResult: ${fails} FAIL, ${warns} WARN.  ${fails ? "FIX THE FAILS BEFORE RELYING ON THIS DATA." : warns ? "Read the warnings above." : "All good."}`);
console.log("(add --verbose to see the details of passing checks too)\n");
process.exit(fails ? 1 : 0);
