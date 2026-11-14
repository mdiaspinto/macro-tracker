const test = require("node:test");
const assert = require("node:assert");
const Session = require("../brain/session.js");

const TODAY = "2026-11-14"; // Saturday; week starts 2026-11-09
const done = (at) => ({ modes: { peek: 600, parade: 0, names: 0 }, minutes: 10, completedAt: at });
const open = () => Session.newDay();

test("newDay shape", () => {
  assert.deepStrictEqual(Session.newDay(), {
    modes: { peek: 0, parade: 0, names: 0 }, minutes: 0, completedAt: null,
    _ms: { peek: 0, parade: 0, names: 0 },
  });
  assert.strictEqual(Session.PEEK_GOAL_S, 600);
  assert.strictEqual(Session.PARADE_S, 180);
  assert.strictEqual(Session.NAMES_MAX_S, 180);
  assert.strictEqual(Session.MAX_DELTA_MS, 2000);
  assert.strictEqual(Session.WEEK_TARGET, 3);
});

test("long gaps do not count", () => {
  const d = Session.addTime(Session.newDay(), "peek", 5000, 1);
  assert.strictEqual(d.modes.peek, 0);
  assert.strictEqual(Session.addTime(d, "peek", -10, 1).modes.peek, 0);
});

test("addTime does not mutate and keeps ms precision", () => {
  const d0 = Session.newDay();
  let d = d0;
  for (let i = 0; i < 4; i++) d = Session.addTime(d, "parade", 600, 1);
  assert.deepStrictEqual(d0, Session.newDay());
  assert.strictEqual(d._ms.parade, 2400);
  assert.strictEqual(d.modes.parade, 2);
});

test("minutes rounds the sum of modes", () => {
  let d = Session.newDay();
  for (let i = 0; i < 40; i++) d = Session.addTime(d, "peek", 1000, 1);
  assert.strictEqual(d.minutes, 1); // 40 s -> 0.67 -> 1
  for (let i = 0; i < 20; i++) d = Session.addTime(d, "names", 1000, 1);
  assert.strictEqual(d.minutes, 1); // 60 s
});

test("unknown mode is ignored", () => {
  const d = Session.newDay();
  assert.strictEqual(Session.addTime(d, "chess", 1000, 1), d);
});

test("completes at 600 s of peek and keeps first completedAt", () => {
  let d = Session.newDay();
  for (let i = 0; i < 299; i++) d = Session.addTime(d, "peek", 2000, 100);
  assert.strictEqual(d.modes.peek, 598);
  assert.strictEqual(d.completedAt, null);
  d = Session.addTime(d, "peek", 2000, 200);
  assert.strictEqual(d.modes.peek, 600);
  assert.strictEqual(d.completedAt, 200);
  d = Session.addTime(d, "peek", 2000, 300);
  assert.strictEqual(d.completedAt, 200);
});

test("parade time alone never completes", () => {
  let d = Session.newDay();
  for (let i = 0; i < 400; i++) d = Session.addTime(d, "parade", 2000, 5);
  assert.strictEqual(d.completedAt, null);
});

test("nextPart order peek -> parade -> names -> done", () => {
  const mk = (peek, parade, names) => ({ modes: { peek, parade, names } });
  assert.strictEqual(Session.nextPart(mk(0, 0, 0), true, 3), "peek");
  assert.strictEqual(Session.nextPart(mk(599, 180, 0), true, 3), "peek");
  assert.strictEqual(Session.nextPart(mk(600, 179, 0), true, 3), "parade");
  assert.strictEqual(Session.nextPart(mk(600, 180, 0), true, 3), "names");
  assert.strictEqual(Session.nextPart(mk(600, 180, 180), true, 3), "done");
  assert.strictEqual(Session.nextPart(mk(600, 180, 0), false, 3), "done");
  assert.strictEqual(Session.nextPart(mk(600, 180, 0), true, 0), "done");
});

test("weekCount counts only this Mon-Sun week", () => {
  const days = {
    "2026-11-08": done(1), // previous Sunday
    "2026-11-09": done(1),
    "2026-11-10": open(),
    "2026-11-12": done(1),
    "2026-11-15": done(1), // after today
  };
  assert.strictEqual(Session.weekCount(days, TODAY), 2);
  assert.strictEqual(Session.weekCount({}, TODAY), 0);
});

test("weekStreak counts back over full weeks", () => {
  const full = (a, b, c) => ({ [a]: done(1), [b]: done(1), [c]: done(1) });
  const lastTwo = Object.assign(full("2026-11-02", "2026-11-03", "2026-11-04"), full("2026-10-26", "2026-10-27", "2026-10-28"));
  assert.strictEqual(Session.weekStreak(lastTwo, TODAY), 2); // this week not full: start at last week
  const withThis = Object.assign({}, lastTwo, full("2026-11-09", "2026-11-10", "2026-11-11"));
  assert.strictEqual(Session.weekStreak(withThis, TODAY), 3);
  const gap = Object.assign(full("2026-11-02", "2026-11-03", "2026-11-04"), full("2026-10-19", "2026-10-20", "2026-10-21"));
  assert.strictEqual(Session.weekStreak(gap, TODAY), 1);
  assert.strictEqual(Session.weekStreak({}, TODAY), 0);
});

test("mergeDay takes max and earliest completedAt", () => {
  const a = { modes: { peek: 600, parade: 10, names: 0 }, minutes: 10, completedAt: 500 };
  const b = { modes: { peek: 100, parade: 50, names: 30 }, minutes: 3, completedAt: 300 };
  const m = Session.mergeDay(a, b);
  assert.deepStrictEqual(m.modes, { peek: 600, parade: 50, names: 30 });
  assert.strictEqual(m.minutes, 11); // 680 s / 60
  assert.strictEqual(m.completedAt, 300);
  assert.strictEqual(Session.mergeDay(a, { modes: b.modes, completedAt: null }).completedAt, 500);
  assert.strictEqual(Session.mergeDay(open(), open()).completedAt, null);
});

test("mergeDay takes max of _ms and falls back to modes * 1000", () => {
  const a = { modes: { peek: 1, parade: 0, names: 0 }, minutes: 0, completedAt: null, _ms: { peek: 1900, parade: 0, names: 0 } };
  const b = { modes: { peek: 1, parade: 2, names: 0 }, minutes: 0, completedAt: null };
  const m = Session.mergeDay(a, b);
  assert.deepStrictEqual(m._ms, { peek: 1900, parade: 2000, names: 0 });
  assert.deepStrictEqual(m.modes, { peek: 1, parade: 2, names: 0 });
  assert.deepStrictEqual(a._ms, { peek: 1900, parade: 0, names: 0 });
});
