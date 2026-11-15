const test = require("node:test");
const assert = require("node:assert");
const Stats = require("../brain/stats.js");
const Session = require("../brain/session.js");

test("add: first and second rating", () => {
  const a = Stats.add({}, "2026-11-16", "peek", 120);
  assert.deepStrictEqual(a["2026-11-16"].peek, { n: 1, sum: 120, best: 120 });
  const b = Stats.add(a, "2026-11-16", "peek", 80);
  assert.deepStrictEqual(b["2026-11-16"].peek, { n: 2, sum: 200, best: 120 });
});

test("add: never changes the input", () => {
  const a = Stats.add({}, "2026-11-16", "peek", 120);
  const copy = JSON.stringify(a);
  Stats.add(a, "2026-11-16", "peek", 80);
  assert.strictEqual(JSON.stringify(a), copy);
});

test("add: bad input is ignored", () => {
  const a = Stats.add({}, "2026-11-16", "peek", 120);
  assert.strictEqual(Stats.add(a, "2026-11-16", "peek", NaN), a);
  assert.strictEqual(Stats.add(a, "2026-11-16", "x", 50), a);
  assert.strictEqual(Stats.add(a, "bad", "peek", 50), a);
});

test("merge", () => {
  assert.deepStrictEqual(Stats.merge({ n: 2, sum: 200, best: 120 }, { n: 1, sum: 150, best: 150 }), { n: 3, sum: 350, best: 150 });
  assert.deepStrictEqual(Stats.merge(undefined, { n: 1, sum: 150, best: 150 }), { n: 1, sum: 150, best: 150 });
  assert.deepStrictEqual(Stats.merge({ n: 1, sum: 5, best: 5 }, undefined), { n: 1, sum: 5, best: 5 });
});

test("weekly uses Monday weeks", () => {
  let s = Stats.add({}, "2026-11-15", "peek", 100);
  s = Stats.add(s, "2026-11-16", "peek", 200);
  const w = Stats.weekly(s, "peek", "2026-11-17", 2);
  assert.strictEqual(w[1].start, "2026-11-16");
  assert.strictEqual(w[0].start, "2026-11-09");
  assert.deepStrictEqual([w[0].avg, w[0].n, w[1].avg, w[1].n], [100, 1, 200, 1]);
});

test("weekly avg rounds, empty week is null, length", () => {
  let s = Stats.add({}, "2026-11-16", "parade", 100);
  s = Stats.add(s, "2026-11-17", "parade", 100);
  s = Stats.add(s, "2026-11-17", "parade", 50);
  const w = Stats.weekly(s, "parade", "2026-11-17", 8);
  assert.strictEqual(w.length, 8);
  assert.strictEqual(w[7].avg, 83);
  assert.strictEqual(w[6].avg, null);
  assert.strictEqual(w[6].n, 0);
});

test("daysPlayed counts days with play time this week only", () => {
  const day = (sec) => { const d = Session.newDay(); d.modes.peek = sec; d._ms.peek = sec * 1000; return d; };
  const sessions = {
    "2026-11-15": day(100), "2026-11-16": day(60), "2026-11-17": day(0),
    "2026-11-18": day(30), "2026-11-12": day(500),
  };
  assert.strictEqual(Stats.daysPlayed(sessions, "2026-11-17"), 1);
  assert.strictEqual(Stats.daysPlayed({ "2026-11-16": { modes: { peek: 5, parade: 0, names: 0 } } }, "2026-11-17"), 1);
  assert.strictEqual(Stats.daysPlayed(undefined, "2026-11-17"), 0);
});
