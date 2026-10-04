// Backup file format + restore SQL tests (no Next/libsql needed). Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { createZip, readZip } from "../lib/zip.ts";
import { upsertSql, normalizeAnnotationRows } from "../lib/restoreSql.ts";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

const sample = () => [
  { name: "manifest.json", data: Buffer.from(JSON.stringify({ format: "x", tables: { cards: 1 } })) },
  { name: "tables/cards.json", data: Buffer.from(JSON.stringify({ columns: ["id"], rows: [{ id: "हिन्दी ✓" }] })) },
  { name: "pdfs/C Programming/Data Types/नोट्स notes.pdf", data: randomBytes(5000) },
  { name: "screenshots/e1/a.png", data: randomBytes(300) },
  { name: "tiny.txt", data: Buffer.from("x") },
];

test("zip round trip keeps every byte and unicode names", () => {
  const input = sample(); // generated once: sample() contains random bytes
  const files = readZip(createZip(input));
  assert.equal(files.length, 5);
  for (const e of input) assert.ok(files.find((f) => f.name === e.name)?.data.equals(e.data), e.name);
});
test("a corrupted byte inside a file is detected (checksum), nothing is returned", () => {
  const z = createZip(sample());
  const i = z.indexOf(Buffer.from("screenshots/e1/a.png")) + 40; // inside the stored image body
  z[i] ^= 0xff;
  assert.throws(() => readZip(z), /Checksum|invalid|incorrect/i);
});
test("truncated zip and random garbage are rejected", () => {
  const z = createZip(sample());
  assert.throws(() => readZip(z.subarray(0, z.length - 30)));
  assert.throws(() => readZip(randomBytes(1000)), /valid zip/i);
});

function db() {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys = ON");
  d.exec(`create table pdfs(id text primary key, title text);
    create table pdf_annotations(key text primary key, pdf_id text not null, page int not null, items_json text not null, foreign key(pdf_id) references pdfs(id) on delete cascade);
    create table pdf_bookmarks(id text primary key, pdf_id text not null, page int, label text, foreign key(pdf_id) references pdfs(id) on delete cascade);`);
  d.exec("insert into pdfs values('p1','notes'); insert into pdf_annotations values('p1:1','p1',1,'[old]');");
  // work done AFTER the backup was taken:
  d.exec("insert into pdf_annotations values('p1:2','p1',2,'[NEW]'); insert into pdf_bookmarks values('b1','p1',9,'new');");
  return d;
}
test("DOCUMENTED BUG: INSERT OR REPLACE of the parent row cascades away newer annotations/bookmarks", () => {
  const d = db();
  d.exec("INSERT OR REPLACE INTO pdfs (id,title) VALUES ('p1','notes')");
  assert.equal(d.prepare("select count(*) n from pdf_annotations").get().n, 0);
  assert.equal(d.prepare("select count(*) n from pdf_bookmarks").get().n, 0);
});
test("FIXED: upsertSql keeps children when the parent row is restored in merge mode", () => {
  const d = db();
  const sql = upsertSql("pdfs", ["id", "title"], ["id"]);
  assert.match(sql, /ON CONFLICT\("id"\) DO UPDATE/);
  d.prepare(sql).run("p1", "notes (restored)");
  assert.equal(d.prepare("select title t from pdfs").get().t, "notes (restored)");
  assert.equal(d.prepare("select count(*) n from pdf_annotations").get().n, 2);
  assert.equal(d.prepare("select count(*) n from pdf_bookmarks").get().n, 1);
});
test("upsertSql: composite keys and key-only tables", () => {
  assert.match(upsertSql("daily_plan_items", ["date", "topic_id", "done"], ["date", "topic_id"]), /ON CONFLICT\("date", "topic_id"\) DO UPDATE SET "done" = excluded."done"/);
  assert.match(upsertSql("t", ["a"], ["a"]), /INSERT OR IGNORE/);
});
test("old-layout annotation rows from an old backup are converted to the current layout", () => {
  const out = normalizeAnnotationRows([
    { id: "a1", pdf_id: "p1", page_number: 1, data_json: '{"type":"pen"}' },
    { id: "a2", pdf_id: "p1", page_number: 1, data_json: '{"type":"rect"}' },
    { id: "a3", pdf_id: "p1", page_number: 4, data_json: '[{"type":"text"}]' },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((r) => r.key).sort(), ["p1:1", "p1:4"]);
  assert.equal(JSON.parse(out.find((r) => r.key === "p1:1").items_json).length, 2);
  // current-layout rows pass through untouched
  const cur = [{ key: "p:1", pdf_id: "p", page: 1, items_json: "[]" }];
  assert.equal(normalizeAnnotationRows(cur), cur);
});
