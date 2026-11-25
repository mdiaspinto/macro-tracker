const test = require("node:test"); const assert = require("node:assert/strict");
const Adapt = require("../adapt.js");

const LEO = { p: 110, c: 130, f: 40 };   // 1320 kcal
const MAR = { p: 215, c: 240, f: 65 };   // 2405 kcal
const base = (o = {}) => ({ goal: "lean", targets: MAR, kg: 90, maintenance: 2700, avgIntake: 2400, loggedDays: 6, first: false, feedback: {}, ...o });

test("weekKey: the Sunday on or before the date", () => {
  assert.equal(Adapt.weekKey("2026-11-25"), "2026-11-22");
  assert.equal(Adapt.weekKey("2026-11-22"), "2026-11-22");
  assert.equal(Adapt.weekKey("2026-11-28"), "2026-11-22");
  assert.equal(Adapt.weekKey("2026-11-29"), "2026-11-29");
});

test("due: only when on and this week is not unveiled yet", () => {
  assert.equal(Adapt.due({}, "2026-11-25"), false);
  assert.equal(Adapt.due({ adaptive: { on: false } }, "2026-11-25"), false);
  assert.equal(Adapt.due({ adaptive: { on: true } }, "2026-11-25"), true);
  assert.equal(Adapt.due({ adaptive: { on: true, week: "2026-11-22" } }, "2026-11-25"), false);
  assert.equal(Adapt.due({ adaptive: { on: true, week: "2026-11-22" } }, "2026-11-29"), true);
});

test("week: logged days, average intake and latest weight from the 7 days before today", () => {
  const meal = (p, c, f, eaten = true) => ({ eaten, ap: p, ac: c, af: f });
  const u = {
    days: {
      "2026-11-17": [meal(100, 100, 100)],                    // outside the window
      "2026-11-18": [meal(50, 100, 20), meal(50, 0, 0)],      // 980
      "2026-11-20": [meal(100, 100, 20)],                     // 980
      "2026-11-21": [meal(10, 10, 10, false)],                // what-if only: not logged
      "2026-11-25": [meal(100, 100, 100)],                    // today: outside the window
    },
    weights: { "2026-11-01": 70, "2026-11-20": 68.5 },
  };
  assert.deepEqual(Adapt.week(u, "2026-11-25"), { loggedDays: 2, avgIntake: 980, kg: 68.5 });
  assert.deepEqual(Adapt.week({}, "2026-11-25"), { loggedDays: 0, avgIntake: 0, kg: null });
});

test("plan: holds without a change in week 1, with few days, or with no measured maintenance", () => {
  for (const [o, reason] of [[{ first: true }, "first"], [{ loggedDays: 3 }, "fewDays"], [{ maintenance: null }, "noData"], [{ kg: null }, "noData"]]) {
    const r = Adapt.plan(base(o));
    assert.equal(r.reason, reason);
    assert.deepEqual(r.to, MAR);
    assert.equal(r.changed, false);
  }
});

test("plan: on pace keeps the macros", () => {
  const r = Adapt.plan(base({ targets: LEO, kg: 68, maintenance: 1700, avgIntake: 1300 }));   // ideal 1326 vs 1320
  assert.equal(r.reason, "onPace");
  assert.deepEqual(r.to, LEO);
  assert.equal(r.kcalFrom, 1320);
  assert.equal(r.kcalTo, 1320);
});

test("plan: slow loss cuts carbs, at most 150 kcal a week", () => {
  const r = Adapt.plan(base());   // ideal 2205 vs 2405
  assert.equal(r.reason, "cut");
  assert.equal(r.capped, true);
  assert.deepEqual(r.to, { p: 215, c: 203, f: 65 });
  assert.equal(r.changed, true);
});

test("plan: one bad feedback answer halves the cut, two hold it", () => {
  const half = Adapt.plan(base({ feedback: { hungry: true } }));
  assert.equal(half.reason, "halfCut");
  assert.deepEqual(half.to, { p: 215, c: 215, f: 65 });
  const hold = Adapt.plan(base({ feedback: { hungry: true, lowEnergy: true } }));
  assert.equal(hold.reason, "holdFeedback");
  assert.deepEqual(hold.to, MAR);
});

test("plan: fast loss raises carbs, feedback does not block a raise", () => {
  const r = Adapt.plan(base({ maintenance: 3100, feedback: { hungry: true, lowEnergy: true } }));   // ideal 2605
  assert.equal(r.reason, "raise");
  assert.deepEqual(r.to, { p: 215, c: 278, f: 65 });
});

test("plan: no new target when the food eaten was far from the target", () => {
  assert.equal(Adapt.plan(base({ avgIntake: 2700 })).reason, "offTarget");
  const bulk = { goal: "bulk", targets: { p: 220, c: 260, f: 75 }, maintenance: 2500 };   // 2595 kcal, ideal 2747.5
  assert.equal(Adapt.plan(base({ ...bulk, avgIntake: 2000 })).reason, "offTarget");
  const up = Adapt.plan(base({ ...bulk, avgIntake: 2600 }));
  assert.equal(up.reason, "raise");
  assert.deepEqual(up.to, { p: 220, c: 298, f: 75 });
});

test("plan: the safety floor limits a cut", () => {
  const r = Adapt.plan(base({ targets: LEO, kg: 68, maintenance: 1500, avgIntake: 1300 }));   // floor 1200
  assert.equal(r.reason, "cut");
  assert.equal(r.floored, true);
  assert.deepEqual(r.to, { p: 110, c: 100, f: 40 });
  assert.equal(r.kcalTo, 1200);
  const none = Adapt.plan(base({ targets: { p: 110, c: 100, f: 40 }, kg: 68, maintenance: 1500, avgIntake: 1200 }));
  assert.equal(none.reason, "floor");
  assert.equal(none.changed, false);
});

test("plan: low protein moves up to 10 g from carbs", () => {
  const r = Adapt.plan(base({ targets: { p: 100, c: 200, f: 50 }, kg: 70, maintenance: 2035, avgIntake: 1650 }));   // ideal 1650
  assert.equal(r.reason, "onPace");
  assert.equal(r.protein, true);
  assert.deepEqual(r.to, { p: 110, c: 190, f: 50 });
  assert.equal(r.kcalTo, 1650);
  assert.equal(r.changed, true);
});

test("plan: carbs stop at 60 g, then fat goes down to its floor", () => {
  const r = Adapt.plan(base({ targets: { p: 150, c: 70, f: 60 }, kg: 80, maintenance: 1600, avgIntake: 1400 }));
  assert.deepEqual(r.to, { p: 150, c: 60, f: 48 });
});

test("mergeAdaptive: the later change wins", () => {
  const a = { on: true, week: "2026-11-22", at: 2 }, b = { on: false, at: 1 };
  assert.equal(Adapt.mergeAdaptive(a, b), a);
  assert.equal(Adapt.mergeAdaptive(b, a), a);
  assert.equal(Adapt.mergeAdaptive(undefined, b), b);
  assert.equal(Adapt.mergeAdaptive(a, undefined), a);
  assert.equal(Adapt.mergeAdaptive(undefined, undefined), undefined);
});
