# GATE 2027 DASHBOARD RELIABILITY AUDIT (offline dashboard)

**Scope of what was really run.** Sandbox had no network and no `node_modules`, so I could NOT run `npm install / build / dev`, a browser, a phone, Windows, power-loss or sleep/wake tests. Everything marked TESTED below was executed against your shipped `local.db` (a copy) with Python/Node SQLite, or with Node unit tests (21 tests, all pass: `npm test`). Everything marked READ was verified by reading the code only. Anything I could not run is marked **NOT TESTED**; it is not a pass.

## 1. Overall verdict
**SAFE ONLY AFTER SPECIFIC FIXES** (the fixes are in `offline-dashboard-fixes.zip`; items still needing your own run are listed in section 17).

Reason: your shipped database had a real P0: the `pdf_annotations` table has the OLD columns, so every annotation save/load fails, while the UI said "Saved" (the client swallowed the HTTP error). That is exactly "silent data loss". Both halves are fixed (schema repair migration + client now throws and retries).

## 2. Critical findings
| ID | Sev | Problem | Evidence | Data-loss risk | Fix (in zip) |
|----|-----|---------|----------|----------------|--------------|
| F1 | P0 | `pdf_annotations` in your DB = (id, page_number, data_json); code uses (key, page, items_json). `CREATE TABLE IF NOT EXISTS` never alters it | TESTED: INSERT -> "no column named key"; SELECT -> "no such column: page" | Every annotation you drew would not be stored | Migration 8 + start-up check rebuild the table in one transaction; old table is renamed, never dropped. Old rows (one-per-stroke or arrays) are carried over. TESTED on a copy: save works afterwards, integrity ok, fk_check clean |
| F2 | P0 | Annotation autosave showed "Saved ✓" even if the server returned 500 (`saveAnnotations` caught everything, `fetch` result never checked) | READ lib/notesDb.ts | Annotations lost silently | Now throws on non-OK; failed pages stay dirty, retry every 5 s, red "Save FAILED - retrying", tab-close prompt while unsaved, keepalive requests on hide/close, PDF switch blocked while unsaved |
| F3 | P0 | Annotation LOAD returned `{}` on any error. The next autosave then overwrote the page's real annotations with only the new strokes | READ | Existing annotations overwritten | Load now throws and shows an error instead of an empty page |
| F4 | P0 | Merge-restore used `INSERT OR REPLACE`. Restoring the `pdfs` row deletes the old row, and with foreign keys ON cascades away newer annotations and bookmarks (and mock sections) | TESTED in SQLite: annotations 2 -> 0, bookmarks 1 -> 0 | Restore could destroy work done after the backup | Real UPSERT (`ON CONFLICT DO UPDATE`), PK read from `table_info`. Unit-tested |
| F5 | P0 | Replace-restore proceeded even when the safety snapshot failed | READ | Replace = delete all rows, no way back | Replace now refuses if the snapshot cannot be written |
| F6 | P1 | Failed delete/update/bookmark calls looked successful (cards, PDFs, bookmarks) | READ | Ghost deletes; deleted item reappears | All now throw on non-OK; callers already show errors |
| F7 | P1 | Backup failures only printed to a terminal that closes; no verification of the snapshot | READ scripts/backup.mjs | You could believe you have backups when you do not | Backup now verifies the snapshot (integrity_check + row counts), checks every copied file size, writes `backup-status.json`; app shows a red bar if the last backup failed/stale or the server is unreachable (`/api/health`) |
| F8 | P1 | PDF mirror used `force:false`: an edited PDF is never re-copied | READ | Stale PDF in backup | Mirror copies when size/mtime differ, via temp file + rename |
| F9 | P1 | Upload: file written, then DB insert; if the insert failed the PDF stayed as an orphan | READ | Orphan files, confusing state | File removed if the insert fails |
| F10 | P1 | PDF delete moved the file first, DB second: a DB failure left a record pointing to a missing file | READ | Broken PDF record | DB delete (3 statements) in ONE transaction first, then move to `_trash` |
| F11 | P1 | Restore wrote PDFs/screenshots directly (a crash leaves a half-written PDF under the real name) and merge overwrote existing files | READ | Corrupt PDF | Temp file + rename; merge never overwrites an existing file |
| F12 | P1 | Restore did not check the manifest row counts or that every table file is present | READ | A truncated backup restored partially | Both checked before the database is touched |
| F13 | P1 | ScoreTrendChart used UTC date (`toISOString().slice(0,10)`) | READ | Between 00:00-05:30 IST the chart used yesterday | Local date |
| F14 | P1 | A failed migration threw an unclear error | READ | - | Clear message, version only advances after success, pre-migration snapshot path shown |

## 3. Data integrity (your shipped DB, a copy; TESTED)
- `PRAGMA integrity_check`: ok. `foreign_key_check`: no rows. journal_mode = wal.
- Shipped schema_version = **4** (code expects 8): migrations 5-8 run on first start (snapshot is taken first because data exists). Missing today: `study_sessions`, `mock_test_sections`, `mock_test_topic_loss`, `daily_plan_items`.
- Rows: cards 4, error_logs 1, pdfs 2, syllabus_progress 14, todo_list 2, study_links 5, library 2/3/2, annotations 0, bookmarks 0, mock_tests 0.
- Orphans in the zip I received: the 2 PDF records and 7 screenshot references point to files that are not in the zip (expected: the zip has no `pdfs/` or `screenshots/`). **On your real machine run `npm run doctor`.**
- There are **no explicit indexes** (only PK). Fine at this size; add only if a page slows (see 14).
- `local.db-wal` was 4.7 MB vs `local.db` 1.5 MB: when copying the DB by hand copy all three files, or use the backup.

## 4. Backup / restore
- TESTED: zip writer/reader round trip (unicode names, CRC corruption, truncation, garbage); restore SQL semantics; phone-export zip is read correctly by the laptop reader and merge-restores a reviewed card.
- **NOT TESTED:** a full backup -> empty environment -> restore with real PDFs/screenshots (needs `npm install` + running app). Do this once: `npm run backup`, copy `BACKUP_DIR`, fresh folder, restore.
- Not tested: corrupted-backup on the live app, interrupted restore (restore DB step is one transaction, so DB changes roll back; files written earlier are only unreferenced leftovers: READ).
- Deleted PDFs in `_trash` are intentionally NOT in backups (READ).
- `/api/backup?pdfs=1` loads the whole zip in memory: fine for hundreds of MB, risky at several GB. 4 GB zip limit is enforced with a clear error.

## 5. PDF safety
Upload/delete hardened (F9, F10). Path traversal: TESTED the two resolvers with 13+ hostile paths (all rejected). Upload sanitisation: READ, folder names reduced to `[A-Za-z0-9_- ]`. Fake/corrupt PDFs are accepted if the name ends in .pdf or MIME says PDF (**P2**: no magic-byte check). Duplicate filenames get a timestamp prefix (READ). PDF IDs use `Date.now()+Math.random()` (P3: collision risk negligible for one user).

## 6. Flashcards / SRS
SM-2 hand-calculated and unit-tested (new card, Good x3 = 1/3/8 days, Hard -0.14 ease, Again -0.8 ease and lapse, ease floor 1.3, purity, due dates across month/leap-year). The Hard rating counts as a pass (standard SM-2 variant). Card save/delete now surface failures. Image files: written by name `<cardId>_<timestamp>`; old files pruned after a save (READ). NOT TESTED: image survive restart/backup in the running app.

## 7. Error log
READ only: screenshots are files with path in JSON; migration moves old base64 to files and keeps base64 if writing fails. `npm run doctor` now reports missing / orphan screenshot files and invalid JSON.

## 8. Timer
READ: end time is a wall-clock timestamp (`endAt`), so tab throttling and sleep do not drift; sessions have a client id and the server uses `INSERT OR IGNORE` (no double count across tabs); failed posts are queued in localStorage and retried. Weak point (**P2**): the retry queue lives in localStorage of that one browser. **NOT TESTED:** sleep 1 min/10 min/1 h, midnight crossing (a session finished after midnight is dated by the finish time, READ).

## 9. Date / time
Study dates use local date helpers everywhere except the one UTC use fixed in F13 (grep checked all `toISOString().slice/split`). Midnight behaviour of IST is unit-tested for `todayStr` (23:59 vs 00:00 IST, TZ forced to Asia/Kolkata). Server-side `todayStr` uses the server's timezone: on your Windows laptop that is IST; if you ever host it elsewhere it is NOT guaranteed.

## 10. API reliability (frontend `fetch` without `.ok` check, READ)
Fixed: notesDb (annotations, bookmarks, cards delete, PDF update/delete). **Still unchecked (P1/P2, not changed because each needs its own UI decision):** `TodoList`, `WeeklyMatrix`, `DashboardHeader`, `roadmap/page`, `syllabus/page` (0 `.ok` checks), `ErrorLog` (2 of 5), `TimerView`, library/study-links/subject-wise/chapter-wise pages (1 of 3 each), `listReviewDays`/`recordReview` (swallow errors by design: only streak stats). Tell me and I will convert these the same way. Silent-empty fallbacks that remain: `listBookmarks` returns `[]` on error (shows no bookmarks, no data written, so P2).

## 11. Offline / PWA reality
- **Offline from the internet: yes.** The Next server, SQLite and PDFs are all on your laptop.
- **Offline from the local server: no.** Every save, PDF and page needs the server process. The service worker only caches the app shell; API/PDF requests need the server. Nothing is stored in the browser except UI settings and the timer state.
- Cached shell is network-first with versioned cache `gate-v3` (old copies are deleted on activate; `/today` added).

## 12. Phone / device sync
Phone -> `http://<laptop-ip>:3000` talks to the same SQLite, so data is identical. Needs `ALLOWED_HOSTS` (middleware) and `next start -H 127.0.0.1` is localhost-only: for LAN you must start with `-H 0.0.0.0` (not changed). Device-specific state in localStorage: sidebar open/closed, auto-reveal, timer state, theme, timer retry queue. None is study data.

## 13. Security
READ: middleware blocks unknown Host headers (DNS-rebinding) and cross-origin unsafe methods. No authentication: anyone who can reach the port can read/delete/restore. Acceptable on 127.0.0.1; on LAN it is not. Path traversal: TESTED (resolvers). `.env.local` and DB files are git-ignored (READ). Not tested: CSRF with a real browser, upload of oversized files.

## 14. Performance (estimates, NOT measured)
No pagination in error logs/cards (READ: whole tables are loaded). Expected fine to ~1,000 cards and ~500 errors; at 5,000 errors the page and screenshot lists will get slow. `today` loads all `error_logs` rows into JS (P2). Add indexes (`cards(due)`, `error_logs(next_review)`, `study_sessions(date)` exists) only when needed.

## 15. Update / migration safety
Keep data outside the code folder (`DATA_DIR=D:/GATE-Data`; your `.env.local` already does). Update procedure: `npm run backup` -> check the green line in the app -> stop server -> replace code (never touch `DATA_DIR`) -> `npm install` -> `npm run build` -> `npm start` -> `npm run doctor`. Migrations take a `pre-migration-*.db` snapshot first (READ; failure to snapshot only warns: **P2**).

## 16. Disaster recovery
1. Fresh code + `npm install`. 2. Set `DATA_DIR` / `BACKUP_DIR`. 3. Database lost: copy the newest `BACKUP_DIR/db/local-*.db` to `DATA_DIR/local.db`; PDFs/screenshots are mirrored in `BACKUP_DIR/pdfs` and `/screenshots` (copy them back). 4. Everything lost: restore a ZIP from `/api/backup?pdfs=1` (Replace mode). 5. Run `npm run doctor`. NOT TESTED end-to-end here.

## 17. Required before daily use (P0/P1)
1. Copy the files in `offline-dashboard-fixes.zip` over the project, run `npm test`, `npm run build`, `npm start`.
2. Start once; check the console says `pdf_annotations rebuilt` / migrations 5-8 done; then `npm run doctor` must show no FAIL.
3. Draw one annotation, reload: it must still be there. Stop the server while drawing: the bar must turn red and recover when you restart it.
4. Do one real backup -> restore into an empty folder test (section 4).
5. Decide which of the remaining unchecked `fetch` pages (section 10) you want converted.

## 18. Recommended (P2/P3)
PDF magic-byte check; pagination for errors/cards; `today` via SQL counts; second backup copy on another disk (the banner warns when backup is on the same drive); LAN auth if you open it to Wi-Fi; Windows tests (long paths, OneDrive, antivirus locks).

## 19. Automated tests added (`npm test`, 21 tests)
SRS (hand-calculated), IST midnight dates, streaks, zip round trip + corruption, restore UPSERT vs REPLACE cascade (documented bug + fix), old-layout annotation conversion, path-traversal guards.

## 20. Daily checklist
```
[ ] Green "Last successful backup" line is today's
[ ] npm run doctor -> no FAIL (weekly)
[ ] Annotation bar says Saved ✓ before closing a PDF
[ ] Backup folder copied to another disk/cloud (weekly)
[ ] After any update: backup -> update -> doctor
```

## Final answer
**Can I depend on it every day for months? Not yet, but yes after the fixes.** Must fix first: F1-F5 (apply the zip, start once so migration 8 repairs the annotations table, confirm with `npm run doctor`), then run one real backup/restore into an empty folder. Without those, annotation work was not actually being saved on the database you sent me. NOT GUARANTEED: crash/power-loss behaviour, sleep/wake timer accuracy and Windows file-lock behaviour (not tested here).
