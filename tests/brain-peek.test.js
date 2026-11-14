const test = require("node:test");
const assert = require("node:assert");
const Peek = require("../brain/peek.js");

const mk = () => { let s = 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const IDS = ["coco", "teo", "rosa", "luna"];
const st = (o) => Object.assign(Peek.init(), o);

test("init values", () => {
  assert.deepStrictEqual(Peek.init(), { level: 1, ms: 500, okRun: 0, fastRun: 0 });
});

test("frames converts ms to 60 Hz frames", () => {
  assert.strictEqual(Peek.frames(500), 30);
  assert.strictEqual(Peek.frames(1), 1);
});

test("level 1 trial has no edge", () => {
  const t = Peek.makeTrial(st(), mk(), IDS);
  assert.strictEqual(t.edge, null);
  assert.deepStrictEqual(t.distractors, []);
  assert.strictEqual(t.choices.length, 2);
  assert.ok(t.choices.includes(t.center));
});

test("level 2 trial has an edge and no distractors", () => {
  const t = Peek.makeTrial(st({ level: 2 }), mk(), IDS);
  assert.ok(Number.isInteger(t.edge) && t.edge >= 0 && t.edge <= 7);
  assert.deepStrictEqual(t.distractors, []);
});

test("level 3 trial has 7 distractors, none at edge", () => {
  const rng = mk();
  for (let i = 0; i < 20; i++) {
    const t = Peek.makeTrial(st({ level: 3 }), rng, IDS);
    assert.strictEqual(t.distractors.length, 7);
    assert.ok(!t.distractors.includes(t.edge));
    assert.strictEqual(new Set(t.distractors).size, 7);
    assert.strictEqual(t.choices.length, 2);
  }
});

test("level 4 has 4 choices including center", () => {
  const t = Peek.makeTrial(st({ level: 4 }), mk(), IDS);
  assert.strictEqual(t.choices.length, 4);
  assert.strictEqual(new Set(t.choices).size, 4);
  assert.ok(t.choices.includes(t.center));
  assert.strictEqual(t.distractors.length, 7);
});

test("level 4 with fewer ids uses all ids", () => {
  const t = Peek.makeTrial(st({ level: 4 }), mk(), ["coco", "teo"]);
  assert.strictEqual(t.choices.length, 2);
});

const right = (s) => { const t = Peek.makeTrial(s, mk(), IDS); return { t, a: { center: t.center, edge: t.edge } }; };
const wrong = (s) => { const t = Peek.makeTrial(s, mk(), IDS); return { t, a: { center: t.choices.find((c) => c !== t.center), edge: t.edge } }; };

test("two correct cut ms by 15%", () => {
  let s = Peek.init();
  let r = right(s); let g = Peek.grade(s, r.t, r.a);
  assert.strictEqual(g.ok, true);
  assert.strictEqual(g.state.ms, 500);
  assert.strictEqual(g.state.okRun, 1);
  s = g.state; r = right(s); g = Peek.grade(s, r.t, r.a);
  assert.strictEqual(g.state.ms, 425);
  assert.strictEqual(g.state.okRun, 0);
});

test("one wrong adds 15%", () => {
  const s = Peek.init(); const r = wrong(s);
  const g = Peek.grade(s, r.t, r.a);
  assert.strictEqual(g.ok, false);
  assert.strictEqual(g.state.ms, 575);
  assert.strictEqual(g.state.okRun, 0);
});

test("wrong edge fails at level 2, ignored at level 1", () => {
  const s2 = st({ level: 2 }); const t2 = Peek.makeTrial(s2, mk(), IDS);
  assert.strictEqual(Peek.grade(s2, t2, { center: t2.center, edge: (t2.edge + 1) % 8 }).ok, false);
  const s1 = Peek.init(); const t1 = Peek.makeTrial(s1, mk(), IDS);
  assert.strictEqual(Peek.grade(s1, t1, { center: t1.center, edge: 3 }).ok, true);
});

test("ms clamps to 17 and 1000", () => {
  const lo = st({ ms: 18, okRun: 1 }); const r = right(lo);
  assert.strictEqual(Peek.grade(lo, r.t, r.a).state.ms, 17);
  const hi = st({ ms: 990 }); const w = wrong(hi);
  assert.strictEqual(Peek.grade(hi, w.t, w.a).state.ms, 1000);
});

test("10 fast trials level up and reset to 500", () => {
  let s = st({ ms: 90 }); let g;
  for (let i = 0; i < 10; i++) {
    const r = right(s); g = Peek.grade(s, r.t, r.a); s = g.state;
    if (i < 9) assert.strictEqual(g.levelUp, false);
  }
  assert.strictEqual(g.levelUp, true);
  assert.deepStrictEqual(s, { level: 2, ms: 500, okRun: 0, fastRun: 0 });
});

test("a trial at 100 ms or more resets fastRun", () => {
  const s = st({ ms: 100, fastRun: 5 }); const r = right(s);
  assert.strictEqual(Peek.grade(s, r.t, r.a).state.fastRun, 0);
});

test("level 4 does not level up", () => {
  let s = st({ level: 4, ms: 90, fastRun: 9 }); const r = right(s);
  const g = Peek.grade(s, r.t, r.a);
  assert.strictEqual(g.levelUp, false);
  assert.strictEqual(g.state.level, 4);
});

test("grade does not mutate input state", () => {
  const s = Peek.init(); const snap = JSON.stringify(s); const r = right(s);
  Peek.grade(s, r.t, r.a);
  assert.strictEqual(JSON.stringify(s), snap);
});
