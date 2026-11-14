const test = require("node:test"); const assert = require("node:assert/strict");
const Brain = require("../brain.js");
const T0 = 1763100000000;
test("profileKey is Firebase-safe", () => {
  assert.equal(Brain.profileKey("Ana M."), "ana m_");
  assert.equal(Brain.profileKey("a/b#c"), "a_b_c");
});

test("profileKey trims and lowercases", () => {
  assert.equal(Brain.profileKey(" Leonor "), "leonor");
  assert.equal(Brain.profileKey(undefined), "");
});
test("ticks mind for completed sessions this and last week", () => {
  const u = {};
  const n = Brain.applyGameSessions(u, { sessions: {
    "2026-11-14": { completedAt: T0 }, "2026-11-04": { completedAt: T0 }, "2026-11-01": { completedAt: T0 },
    "2026-11-13": { modes: { peek: 300 } } } }, "2026-11-14");
  assert.equal(n, 2);                       // 11-01 is before last Monday (11-02); 11-13 is not complete
  assert.equal(u.habits["2026-11-14"].mind, true);
  assert.equal(u.habitsAt["2026-11-14"].mind, T0);
  assert.equal((u.habits["2026-11-01"] || {}).mind, undefined);
});
test("manual untick after completion is kept", () => {
  const u = { habits: { "2026-11-14": { mind: false } }, habitsAt: { "2026-11-14": { mind: T0 + 1 } } };
  assert.equal(Brain.applyGameSessions(u, { sessions: { "2026-11-14": { completedAt: T0 } } }, "2026-11-14"), 0);
  assert.equal(u.habits["2026-11-14"].mind, false);
});
test("already ticked with same time is not counted again", () => {
  const u = { habits: { "2026-11-14": { mind: true } }, habitsAt: { "2026-11-14": { mind: T0 } } };
  assert.equal(Brain.applyGameSessions(u, { sessions: { "2026-11-14": { completedAt: T0 } } }, "2026-11-14"), 0);
});
test("missing data is a no-op", () => {
  assert.equal(Brain.applyGameSessions({}, null, "2026-11-14"), 0);
});
test("skips bad date keys and non-finite completedAt", () => {
  const u = {};
  const n = Brain.applyGameSessions(u, { sessions: {
    "2026-11-14x": { completedAt: T0 }, "2026-11-1": { completedAt: T0 }, "2026-11-13": { completedAt: "5" },
    "2026-11-12": { completedAt: Infinity }, "2026-11-11": { completedAt: {} }, "2026-11-10": { completedAt: T0 } } }, "2026-11-14");
  assert.equal(n, 1);
  assert.deepEqual(Object.keys(u.habits), ["2026-11-10"]);
});
