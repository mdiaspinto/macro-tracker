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
