// Path-traversal tests for the two functions that guard every file the API serves/restores. Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gate-paths-"));
process.env.DATA_DIR = tmp;
const { resolvePdfPath, resolveShotPath, PDF_DIR, SHOT_DIR } = await import("../lib/paths.ts");

const evil = ["../../local.db", "../.env.local", "pdfs/../../local.db", "pdfs/../local.db", "pdfs/../screenshots/x.png", "pdfs\\..\\..\\local.db",
  "/etc/passwd", "C:\\Windows\\win.ini", "pdfs/../../../etc/passwd", "local.db", "", "pdfs", "pdfs/"];
test("resolvePdfPath rejects every traversal / foreign path", () => { for (const e of evil) assert.equal(resolvePdfPath(e), null, e); });
test("resolveShotPath rejects every traversal / foreign path", () => {
  for (const e of [...evil, "screenshots/../local.db", "screenshots/../pdfs/a.pdf", "screenshots"]) assert.equal(resolveShotPath(e), null, e);
});
test("normal stored paths resolve inside the allowed folders", () => {
  assert.equal(resolvePdfPath("pdfs/C Programming/Ch 1/a.pdf"), path.join(PDF_DIR, "C Programming", "Ch 1", "a.pdf"));
  assert.equal(resolveShotPath("screenshots/123/img.png"), path.join(SHOT_DIR, "123", "img.png"));
  assert.ok(resolvePdfPath("pdfs\\Subject\\a.pdf")); // Windows-style separators from older rows
});
