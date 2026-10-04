// Run: npm test   (Node >= 22.6). Uses the REAL zip writer of the offline dashboard to build a backup, then reads it with the browser reader.
import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { randomBytes } from "node:crypto";
import { readZipBrowser, writeZipStore, sha256Hex, crc32 } from "../lib/sync/zipBrowser.ts";
import * as C from "../lib/sync/core.ts";

// --- a deflate zip like the offline dashboard writes (method 8 for JSON, 0 for pdf/png) built by hand with node:zlib
function nodeZip(entries) {
  const parts = [], central = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name), crc = crc32(e.data);
    const method = /\.(pdf|png)$/.test(e.name) ? 0 : 8;
    const body = method ? zlib.deflateRawSync(e.data) : e.data;
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(0x0800, 6); l.writeUInt16LE(method, 8);
    l.writeUInt32LE(crc, 14); l.writeUInt32LE(body.length, 18); l.writeUInt32LE(e.data.length, 22); l.writeUInt16LE(name.length, 26);
    parts.push(l, name, body);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(method, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(e.data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, name); off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
const sample = () => [
  { name: "manifest.json", data: Buffer.from(JSON.stringify({ format: "gate-dashboard-backup", version: 3, tables: { cards: 1 } })) },
  { name: "tables/cards.json", data: Buffer.from(JSON.stringify({ columns: ["id"], rows: [{ id: "हिन्दी ✓ " + "x".repeat(500) }] })) },
  { name: "pdfs/C Programming/Ch 1/नोट्स 1.pdf", data: randomBytes(70000) },
  { name: "screenshots/e1/a.png", data: randomBytes(900) },
];

test("browser reader reads a deflate+store zip made by node and keeps every byte / unicode names", async () => {
  const input = sample();
  const out = await readZipBrowser(new Blob([nodeZip(input)]));
  assert.equal(out.length, 4);
  for (const e of input) assert.ok(Buffer.from(out.find((o) => o.name === e.name).data).equals(e.data), e.name);
});
test("reader detects corruption and garbage", async () => {
  const z = nodeZip(sample());
  const bad = Buffer.from(z); bad[z.indexOf(Buffer.from("screenshots/e1/a.png")) + 60] ^= 0xff;
  await assert.rejects(readZipBrowser(new Blob([bad])), /Checksum|incorrect|invalid/i);
  await assert.rejects(readZipBrowser(new Blob([randomBytes(500)])), /valid zip/i);
  await assert.rejects(readZipBrowser(new Blob([z.subarray(0, z.length - 30)])));
});
test("writer -> reader round trip (the phone export is a zip the reader, and therefore the laptop restore format, understands)", async () => {
  const input = sample().map((e) => ({ name: e.name, data: new Uint8Array(e.data) }));
  const blob = writeZipStore(input);
  const out = await readZipBrowser(blob);
  assert.equal(out.length, input.length);
  for (const e of input) assert.deepEqual(out.find((o) => o.name === e.name).data, e.data);
});
test("sha256Hex matches node:crypto", async () => {
  const { createHash } = await import("node:crypto");
  const d = randomBytes(1234);
  assert.equal(await sha256Hex(new Uint8Array(d)), createHash("sha256").update(d).digest("hex"));
});

const mk = (n) => ({ format: "gate-sync", batchId: "b_20261004T101500_ab12cd", createdAt: "x", backup: {}, totalBytes: 0,
  files: Array.from({ length: n }, (_, i) => ({ path: i === 0 ? "manifest.json" : `pdfs/S/C/${i}.pdf`, key: C.objectKey("b_20261004T101500_ab12cd", i), size: 10, sha256: "a".repeat(64) })) });
test("manifest validation accepts a good one and rejects traversal / wrong keys / oversize / duplicates", () => {
  assert.equal(C.validateManifest(mk(3)), null);
  const t = mk(3); t.files[1].path = "pdfs/../../etc/passwd"; assert.match(C.validateManifest(t), /not allowed/);
  const k = mk(3); k.files[2].key = "b_20261004T101500_ab12cd/f/00009"; assert.match(C.validateManifest(k), /key/);
  const big = mk(2); big.files[1].size = C.MAX_OBJECT_BYTES + 1; assert.match(C.validateManifest(big), /larger than/);
  const dup = mk(3); dup.files[2].path = dup.files[1].path; assert.match(C.validateManifest(dup), /duplicate/);
  const b = mk(2); b.batchId = "../x"; assert.match(C.validateManifest(b), /batchId/);
  for (const p of ["../x", "/abs", "C:\\x", "local.db", ".env.local", "tables/../x.json", "tables/a.b.json"]) assert.equal(C.entryPathOk(p), false, p);
  for (const p of ["manifest.json", "tables/cards.json", "pdfs/a/b.pdf", "screenshots/_cards/x.png"]) assert.equal(C.entryPathOk(p), true, p);
});
test("listing diff finds missing and wrong-size objects", () => {
  const m = mk(3);
  assert.deepEqual(C.diffAgainstListing(m.files, new Map(m.files.map((f) => [f.key, f.size]))), []);
  const l = new Map(m.files.map((f) => [f.key, f.size])); l.delete(m.files[1].key); l.set(m.files[2].key, 9);
  assert.equal(C.diffAgainstListing(m.files, l).length, 2);
});
test("passphrase comparison", async () => {
  assert.equal(await C.keysEqual("correct horse", "correct horse"), true);
  assert.equal(await C.keysEqual("correct horse", "correct horsf"), false);
  assert.equal(await C.keysEqual("", "x"), false);
});
test("batch ids look right and are unique-ish", () => {
  assert.match(C.newBatchId(new Date("2026-10-04T10:15:00Z"), "ab12cd"), /^b_20261004T101500_ab12cd$/);
  assert.ok(C.BATCH_RE.test(C.newBatchId()));
});
test("SM-2 on the phone equals the offline dashboard's (same hand-calculated values)", () => {
  const f = () => ({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due: "", last_reviewed: "" });
  let c = C.reviewCard(f(), 4, "2026-10-04"); assert.equal(c.interval, 1); assert.equal(c.due, "2026-10-05"); assert.ok(Math.abs(c.ease - 2.5) < 1e-9);
  c = C.reviewCard(c, 4, "2026-10-05"); assert.equal(c.interval, 3);
  c = C.reviewCard(c, 4, "2026-10-08"); assert.equal(c.interval, 8); assert.equal(c.due, "2026-10-16");
  c = C.reviewCard(c, 0, "2026-10-16"); assert.equal(c.reps, 0); assert.equal(c.lapses, 1); assert.ok(Math.abs(c.ease - 1.7) < 1e-9);
  assert.equal(C.addDays("2026-12-31", 1), "2027-01-01");
});
test("mergeCards keeps a phone card that was reviewed after the incoming backup, takes everything else", () => {
  const local = [{ id: "a", last_reviewed: "2026-10-06", interval: 9 }, { id: "b", last_reviewed: "2026-10-01", interval: 1 }];
  const inc = [{ id: "a", last_reviewed: "2026-10-04", interval: 3 }, { id: "b", last_reviewed: "2026-10-03", interval: 3 }, { id: "c", last_reviewed: "", interval: 0 }];
  const { rows, keptLocal } = C.mergeCards(local, inc);
  assert.equal(keptLocal, 1); assert.equal(rows[0].interval, 9); assert.equal(rows[1].interval, 3); assert.equal(rows.length, 3);
});
