// SRS (SM-2) + date tests. Expected values are hand-calculated, not copied from the code's output.
// Run: npm test   (Node >= 22.6)
process.env.TZ = "Asia/Kolkata"; // all study dates must be INDIAN local dates
import test from "node:test";
import assert from "node:assert/strict";
import { review, todayStr, addDays, computeStreak } from "../lib/srs.ts";

const fresh = () => ({ id: "c", front: "f", back: "b", subject: "s", topic: "t", ease: 2.5, interval: 0, reps: 0, lapses: 0, due: "2026-10-04", lastReviewed: "" });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("new card, Good: 1 day, ease unchanged (2.5 + 0.1 - 1*(0.08+0.02) = 2.5)", () => {
  const c = review(fresh(), 4, "2026-10-04");
  assert.equal(c.reps, 1); assert.equal(c.interval, 1); near(c.ease, 2.5);
  assert.equal(c.due, "2026-10-05"); assert.equal(c.lastReviewed, "2026-10-04"); assert.equal(c.lapses, 0);
});
test("Good, Good, Good: intervals 1, 3, round(3*2.5)=8", () => {
  let c = review(fresh(), 4, "2026-10-04");
  c = review(c, 4, "2026-10-05"); assert.equal(c.interval, 3); assert.equal(c.due, "2026-10-08");
  c = review(c, 4, "2026-10-08"); assert.equal(c.interval, 8); assert.equal(c.due, "2026-10-16");
});
test("Easy raises ease by 0.1", () => { near(review(fresh(), 5, "2026-10-04").ease, 2.6); });
test("Hard lowers ease by 0.14 (0.1 - 2*(0.08+0.04)) and still counts as a pass", () => {
  const c = review(fresh(), 3, "2026-10-04"); near(c.ease, 2.36); assert.equal(c.reps, 1); assert.equal(c.lapses, 0);
});
test("Again: reps reset, interval 1, lapses+1, ease -0.8 (0.1 - 5*(0.08+0.10))", () => {
  let c = review(review(fresh(), 4, "2026-10-04"), 4, "2026-10-05");
  c = review(c, 0, "2026-10-08");
  assert.equal(c.reps, 0); assert.equal(c.interval, 1); assert.equal(c.lapses, 1); near(c.ease, 1.7); assert.equal(c.due, "2026-10-09");
});
test("ease never drops below 1.3 after many lapses; lapses count up", () => {
  let c = fresh();
  for (let i = 0; i < 6; i++) c = review(c, 0, "2026-10-04");
  near(c.ease, 1.3); assert.equal(c.lapses, 6);
});
test("review() does not modify the input card", () => {
  const c = fresh(); const before = JSON.stringify(c); review(c, 4, "2026-10-04"); assert.equal(JSON.stringify(c), before);
});
test("interval is always >= 1 and due is always in the future of the review day", () => {
  for (const q of [0, 3, 4, 5]) { const c = review(fresh(), q, "2026-10-04"); assert.ok(c.interval >= 1); assert.ok(c.due > "2026-10-04"); }
});
test("addDays crosses month / year / leap-day boundaries", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-10-01", -1), "2026-09-30");
});
test("todayStr uses the LOCAL (IST) date, not UTC - midnight edge", () => {
  // 2026-10-03 19:00 UTC == 2026-10-04 00:30 IST: UTC-based code would say 10-03
  assert.equal(todayStr(new Date("2026-10-03T19:00:00Z")), "2026-10-04");
  assert.equal(todayStr(new Date("2026-10-04T18:29:00Z")), "2026-10-04"); // 23:59 IST
  assert.equal(todayStr(new Date("2026-10-04T18:30:00Z")), "2026-10-05"); // 00:00 IST
});
test("streak: today not yet studied does not break it; a gap does", () => {
  const today = todayStr();
  const y = addDays(today, -1), y2 = addDays(today, -2), y4 = addDays(today, -4);
  assert.equal(computeStreak([{ date: y, count: 1 }, { date: y2, count: 3 }]), 2);
  assert.equal(computeStreak([{ date: today, count: 1 }, { date: y, count: 1 }]), 2);
  assert.equal(computeStreak([{ date: y4, count: 1 }]), 0);
});
