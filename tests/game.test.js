const test = require("node:test"); const assert = require("node:assert/strict");
const Game = require("../game.js");
const meal = (o = {}) => ({ id: "m", name: "x", eaten: true, ap: 0, ac: 0, af: 0, ...o });
const mk = (dates, goalT) => ({ goal: "lean", targets: { lean: goalT || { p: 100, c: 220, f: 80 }, bulk: { p: 1, c: 1, f: 1 } }, days: Object.fromEntries(dates.map(d => [d, [meal()]])) });
const range = (a, b) => { const out = []; for (let d = new Date(...a.split("-").map((n, i) => i === 1 ? n - 1 : +n)); ; d.setDate(d.getDate() + 1)) { const s = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); out.push(s); if (s === b) return out; } };

test("streak: consecutive days, today unlogged skipped", () => {
  const u = mk(range("2026-11-07", "2026-11-11"));
  assert.equal(Game.streak(u, "2026-11-11"), 5);
  assert.equal(Game.streak(u, "2026-11-12"), 5);
  assert.equal(Game.streak(mk([]), "2026-11-11"), 0);
});
test("streak: one gap per Mon-Sun week forgiven (adds 0)", () => {
  const days = range("2026-11-02", "2026-11-11").filter(d => d !== "2026-11-06");
  assert.equal(Game.streak(mk(days), "2026-11-11"), 9);
});
test("streak: second gap in same week ends the run", () => {
  const days = range("2026-11-02", "2026-11-08").filter(d => d !== "2026-11-03" && d !== "2026-11-05");
  assert.equal(Game.streak(mk(days), "2026-11-08"), 4);
});
test("streak: what-if-only and malformed days are gaps", () => {
  const u = mk(range("2026-11-02", "2026-11-11"));
  u.days["2026-11-10"] = [meal({ eaten: false })];
  u.days["2026-11-09"] = "junk"; u.days["2026-11-08"] = [null];
  assert.equal(Game.streak(u, "2026-11-11"), 1);
});
test("streak: stops before earliest eaten day", () => {
  assert.equal(Game.streak(mk(["2026-11-11"]), "2026-11-11"), 1);
});
test("streak: gaps on a Sunday and the following Monday are both forgiven", () => {
  const days = range("2026-11-02", "2026-11-11").filter(d => d !== "2026-11-08" && d !== "2026-11-09");
  assert.equal(Game.streak(mk(days), "2026-11-11"), 8);
});
// streakHistory is not used by the app; it is kept as the test oracle for streak.
test("streakHistory matches streak for every day", () => {
  const days = range("2026-10-01", "2026-11-11").filter(d => !["2026-10-06", "2026-10-08", "2026-11-04", "2026-11-11"].includes(d));
  const u = mk(days), h = Game.streakHistory(u, "2026-11-11");
  for (const d of range("2026-10-01", "2026-11-11")) assert.equal(h[d], Game.streak(u, d), d);
  assert.equal(h["2026-10-01"], 1);
  assert.deepEqual(Game.streakHistory(mk([]), "2026-11-11"), {});
});
const star = (o, date = "2026-11-11") => { const u = mk([]); u.days[date] = [meal(o)]; return Game.dayStar(u, date); };
test("dayStar: 10% boundary (target 2000 kcal, p100 c220 f80)", () => {
  assert.equal(star({ ap: 100, ac: 270, af: 80 }), true);    // 2200
  assert.equal(star({ ap: 100, ac: 270.5, af: 80 }), false); // 2202
  assert.equal(star({ ap: 100, ac: 170, af: 80 }), true);    // 1800
  assert.equal(star({ ap: 100, ac: 169.5, af: 80 }), false); // 1798
});
test("dayStar: protein, empty, what-if", () => {
  assert.equal(star({ ap: 89, ac: 231, af: 80 }), false);
  assert.equal(star({ ap: 90, ac: 229, af: 80 }), true);
  assert.equal(Game.dayStar(mk([]), "2026-11-11"), false);
  assert.equal(star({ eaten: false, ap: 100, ac: 220, af: 80 }), false);
  assert.equal(Game.dayStar({ days: { "2026-11-11": "x" } }, "2026-11-11"), false);
});

// ---- badges & celebrations ----
const FOOD = ["greens", "veg", "berries", "nuts", "beans", "fish", "grains", "olive"], HAB = ["strength", "walk", "sleep", "social", "mind"];
const wk = (u, mon, f) => { for (let i = 0; i < 7; i++) f(u, range(mon, "2099-01-01").slice(0, 7)[i]); return u; };
const addMeals = (u, d, n, brain) => { u.days[d] = (u.days[d] || []).concat(Array.from({ length: n }, () => meal({ brain }))); };
const addHabit = (u, d, ids) => { u.habits = u.habits || {}; u.habits[d] = { ...(u.habits[d] || {}), ...Object.fromEntries(ids.map(i => [i, true])) }; };
const fullWeek = (u, mon) => wk(u, mon, (x, d) => { addMeals(x, d, 3, FOOD); addHabit(x, d, HAB); });
const byId = (u, today = "2026-11-11") => Object.fromEntries(Game.badges(u, today).map(b => [b.id, b]));
const empty = () => mk([]);
const mondays = ["2026-09-14", "2026-09-28", "2026-10-12", "2026-10-26"]; // non-consecutive weeks

test("BADGES: ids in order, one level badge per level above sprout", () => {
  assert.deepEqual(Game.BADGES.map(b => b.id), ["firstLog", "streak7", "streak30", "fishWeek", "fullBrain", "cleanWeek", "strongWeek", "berryLover", "greenMachine", "socialButterfly", "macroMaster", "level:growing", "level:sharp", "level:brilliant", "level:genius", "level:legend"]);
  assert.deepEqual(Game.badges(empty(), "2026-11-11").map(b => b.id), Game.BADGES.map(b => b.id));
  assert.ok(Game.badges(empty(), "2026-11-11").every(b => !b.earned && b.date === null));
});
test("badge firstLog", () => {
  const u = mk(["2026-11-05", "2026-11-03"]); u.days["2026-11-01"] = [meal({ eaten: false })];
  assert.deepEqual(byId(u).firstLog, { id: "firstLog", earned: true, date: "2026-11-03" });
  assert.equal(byId(empty()).firstLog.earned, false);
});
test("badge streak7 / streak30", () => {
  const u = mk(range("2026-11-01", "2026-11-07"));
  assert.deepEqual(byId(u).streak7, { id: "streak7", earned: true, date: "2026-11-07" });
  assert.equal(byId(mk(range("2026-11-01", "2026-11-06"))).streak7.earned, false);
  assert.equal(byId(u).streak30.earned, false);
  const v = mk(range("2026-10-01", "2026-11-11"));
  assert.equal(byId(v).streak30.date, "2026-10-30");
  assert.equal(byId(mk(range("2026-10-14", "2026-11-11"))).streak30.earned, false); // 29 days
});
test("badge fishWeek (date = Monday of the week)", () => {
  const u = empty(); addMeals(u, "2026-11-04", 2, ["fish"]);
  assert.deepEqual(byId(u).fishWeek, { id: "fishWeek", earned: true, date: "2026-11-02" });
  const v = empty(); addMeals(v, "2026-11-04", 1, ["fish"]);
  assert.equal(byId(v).fishWeek.earned, false);
});
test("badge strongWeek", () => {
  const u = empty(); addHabit(u, "2026-11-03", ["strength"]); addHabit(u, "2026-11-05", ["strength"]);
  assert.deepEqual(byId(u).strongWeek, { id: "strongWeek", earned: true, date: "2026-11-02" });
  const v = empty(); addHabit(v, "2026-11-03", ["strength"]);
  assert.equal(byId(v).strongWeek.earned, false);
});
test("badges fullBrain and cleanWeek", () => {
  const u = fullWeek(empty(), "2026-11-02");
  assert.deepEqual(byId(u).fullBrain, { id: "fullBrain", earned: true, date: "2026-11-02" });
  assert.equal(byId(u).cleanWeek.date, "2026-11-02");
  const v = empty(); addMeals(v, "2026-11-04", 1, ["fish"]);
  assert.equal(byId(v).fullBrain.earned, false);
  assert.equal(byId(v).cleanWeek.earned, false);
  const w = empty(); wk(w, "2026-11-02", (x, d) => addMeals(x, d, 1, []));
  assert.equal(byId(w).cleanWeek.earned, true);
  assert.equal(byId(w).fullBrain.earned, false);
});
test("badges berryLover / greenMachine / socialButterfly need 4 weeks (not consecutive)", () => {
  const u = empty();
  mondays.forEach(m => { addMeals(u, addDays0(m, 0), 2, ["berries"]); addMeals(u, addDays0(m, 1), 6, ["greens"]); for (let i = 0; i < 3; i++) addHabit(u, addDays0(m, i), ["social"]); });
  const b = byId(u);
  for (const id of ["berryLover", "greenMachine", "socialButterfly"]) assert.deepEqual(b[id], { id, earned: true, date: "2026-10-26" });
  const v = empty();
  mondays.slice(0, 3).forEach(m => addMeals(v, m, 2, ["berries"]));
  assert.equal(byId(v).berryLover.earned, false);
  assert.equal(byId(v).greenMachine.earned, false);
});
function addDays0(s, n) { return range(s, "2099-01-01")[n]; }
test("badge macroMaster: 7 star days in a row", () => {
  const u = empty(); range("2026-11-01", "2026-11-07").forEach(d => { u.days[d] = [meal({ ap: 100, ac: 220, af: 80 })]; });
  assert.deepEqual(byId(u).macroMaster, { id: "macroMaster", earned: true, date: "2026-11-07" });
  delete u.days["2026-11-04"]; u.days["2026-11-04"] = [meal()];
  assert.equal(byId(u).macroMaster.earned, false);
});
test("level badges: date = Monday of the week cumulative points reach min", () => {
  const u = fullWeek(fullWeek(empty(), "2026-10-26"), "2026-11-02");
  const b = byId(u);
  assert.deepEqual(b["level:growing"], { id: "level:growing", earned: true, date: "2026-11-02" });
  assert.equal(b["level:sharp"].earned, false);
  assert.equal(byId(fullWeek(empty(), "2026-11-02"))["level:growing"].earned, false);
});
test("badges ignore weeks after today", () => {
  const u = empty(); addMeals(u, "2026-11-20", 2, ["fish"]);
  assert.equal(byId(u).fishWeek.earned, false);
  assert.equal(byId(u).firstLog.earned, false);
});
test("badges: malformed data never throws", () => {
  assert.doesNotThrow(() => Game.badges({ days: { "2026-11-01": "x", "2026-11-02": [null] }, habits: { "2026-11-01": null } }, "2026-11-11"));
  assert.doesNotThrow(() => Game.badges(null, "2026-11-11"));
  assert.doesNotThrow(() => Game.newCelebrations(null, "2026-11-11"));
});
test("newCelebrations: fresh badge, then nothing once celebrated", () => {
  const u = empty(); addMeals(u, "2026-11-04", 2, ["fish"]);
  const c = Game.newCelebrations(u, "2026-11-11");
  assert.deepEqual(c.filter(x => x.type === "badge"), [{ type: "badge", id: "firstLog" }, { type: "badge", id: "fishWeek" }]);
  u.celebrated = {}; c.forEach(x => { u.celebrated[Game.celebrationKey(x)] = "2026-11-11"; });
  assert.deepEqual(Game.newCelebrations(u, "2026-11-11"), []);
  assert.equal(Game.celebrationKey({ type: "badge", id: "fishWeek" }), "fishWeek");
});
test("newCelebrations: level reported as level only; keys", () => {
  const u = fullWeek(fullWeek(empty(), "2026-10-26"), "2026-11-02");
  const c = Game.newCelebrations(u, "2026-11-11");
  assert.ok(c.some(x => x.type === "level" && x.id === "growing"));
  assert.ok(!c.some(x => x.type === "badge" && x.id.startsWith("level:")));
  assert.equal(Game.celebrationKey({ type: "level", id: "growing" }), "level:growing");
  assert.equal(Game.celebrationKey({ type: "fullWeek", id: "2026-11-02" }), "week:2026-11-02");
});
test("newCelebrations: only the current full week is a fullWeek", () => {
  const u = fullWeek(empty(), "2026-10-26");
  assert.ok(!Game.newCelebrations(u, "2026-11-11").some(x => x.type === "fullWeek"));
  fullWeek(u, "2026-11-09");
  assert.deepEqual(Game.newCelebrations(u, "2026-11-11").filter(x => x.type === "fullWeek"), [{ type: "fullWeek", id: "2026-11-09" }]);
  u.celebrated = { "week:2026-11-09": "2026-11-11" };
  assert.ok(!Game.newCelebrations(u, "2026-11-11").some(x => x.type === "fullWeek"));
});
test("newCelebrations: empty user", () => {
  assert.deepEqual(Game.newCelebrations(empty(), "2026-11-11"), []);
  assert.ok(Game.badges(empty(), "2026-11-11").every(b => !b.earned));
});
test("streak badges: a logged-day-only start, gaps forgiven like streak()", () => {
  // 6 days, a rest day (Fri 11-06 forgiven), then 6 more: 12 logged days; streak reaches 7 on the 7th logged day
  const days = range("2026-11-01", "2026-11-12").filter(d => d !== "2026-11-06");
  assert.equal(byId(mk(days), "2026-11-12").streak7.date, "2026-11-08");
  // unlogged past day can never be the date: 6 days, one gap day, then 1 day -> streak reaches 7 on the day after the gap
  const u = mk(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-09"]);
  assert.equal(byId(u, "2026-11-09").streak7.date, "2026-11-09");
  assert.equal(Game.streakHistory(u, "2026-11-09")["2026-11-08"], 6);
  // two gaps in one week break the run
  const v = mk(["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-07", "2026-11-08"]);
  assert.equal(byId(v, "2026-11-08").streak7.earned, false);
});
test("newCelebrations with a precomputed badge list matches omitting it", () => {
  const u = fullWeek(empty(), "2026-11-09");
  assert.deepEqual(Game.newCelebrations(u, "2026-11-11", Game.badges(u, "2026-11-11")), Game.newCelebrations(u, "2026-11-11"));
});
