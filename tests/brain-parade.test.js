const test = require("node:test");
const assert = require("node:assert");
const Parade = require("../brain/parade.js");

const mk = () => { let s = 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const IDS = ["pepe", "teo", "flor", "hugo"];
const st = (o) => Object.assign(Parade.init(), o);

test("init values", () => {
  assert.deepStrictEqual(Parade.init(), { span: 2, ms: 1800, okRun: 0, badRun: 0, count: 0 });
});

test("distinct ids when span <= cast", () => {
  const rng = mk();
  for (let span = 2; span <= 4; span++) {
    for (let i = 0; i < 50; i++) {
      const { seq } = Parade.makeSequence(st({ span }), rng, IDS);
      assert.strictEqual(seq.length, span);
      assert.strictEqual(new Set(seq).size, span);
      seq.forEach((id) => assert.ok(IDS.includes(id)));
    }
  }
});

test("no immediate repeat when span > cast", () => {
  const rng = mk();
  for (let i = 0; i < 200; i++) {
    const { seq } = Parade.makeSequence(st({ span: 7 }), rng, IDS);
    assert.strictEqual(seq.length, 7);
    for (let k = 1; k < seq.length; k++) assert.notStrictEqual(seq[k], seq[k - 1]);
  }
});

test("makeSequence does not mutate input", () => {
  const ids = IDS.slice(), s = st({ span: 5 }), copy = JSON.stringify(s);
  Parade.makeSequence(s, mk(), ids);
  assert.deepStrictEqual(ids, IDS);
  assert.strictEqual(JSON.stringify(s), copy);
});

test("reverse only from span 6 on odd rounds", () => {
  const rng = mk();
  assert.strictEqual(Parade.makeSequence(st({ span: 5, count: 1 }), rng, IDS).reverse, false);
  assert.strictEqual(Parade.makeSequence(st({ span: 6, count: 0 }), rng, IDS).reverse, false);
  assert.strictEqual(Parade.makeSequence(st({ span: 6, count: 1 }), rng, IDS).reverse, true);
  assert.strictEqual(Parade.makeSequence(st({ span: 8, count: 2 }), rng, IDS).reverse, false);
  assert.strictEqual(Parade.makeSequence(st({ span: 8, count: 3 }), rng, IDS).reverse, true);
});

test("two correct grow span", () => {
  const round = { seq: ["pepe", "teo", "flor"], reverse: false };
  const a = Parade.grade(st({ span: 3 }), round, round.seq);
  assert.strictEqual(a.ok, true);
  assert.deepStrictEqual(a.state, { span: 3, ms: 1620, okRun: 1, badRun: 0, count: 1 });
  const b = Parade.grade(a.state, round, round.seq);
  assert.deepStrictEqual(b.state, { span: 4, ms: 1458, okRun: 0, badRun: 0, count: 2 });
});

test("two wrong shrink span, min 2", () => {
  const round = { seq: ["pepe", "teo", "flor"], reverse: false };
  const bad = ["hugo", "hugo", "hugo"];
  const a = Parade.grade(st({ span: 3 }), round, bad);
  assert.strictEqual(a.ok, false);
  assert.deepStrictEqual(a.state, { span: 3, ms: 2000, okRun: 0, badRun: 1, count: 1 });
  const b = Parade.grade(a.state, round, bad);
  assert.deepStrictEqual(b.state, { span: 2, ms: 2000, okRun: 0, badRun: 0, count: 2 });
  const c = Parade.grade(Parade.grade(b.state, round, bad).state, round, bad);
  assert.strictEqual(c.state.span, 2);
});

test("a wrong answer resets okRun and a correct one resets badRun", () => {
  const round = { seq: ["pepe", "teo", "flor"], reverse: false };
  const bad = ["teo", "pepe", "flor"];
  const a = Parade.grade(st({ okRun: 1 }), round, bad);
  assert.strictEqual(a.state.okRun, 0);
  assert.strictEqual(a.state.badRun, 1);
  const b = Parade.grade(st({ badRun: 1 }), round, round.seq);
  assert.strictEqual(b.state.badRun, 0);
  assert.strictEqual(b.state.okRun, 1);
});

test("reverse answer graded against reversed seq", () => {
  const round = { seq: ["pepe", "teo", "flor"], reverse: true };
  assert.strictEqual(Parade.grade(st(), round, ["flor", "teo", "pepe"]).ok, true);
  assert.strictEqual(Parade.grade(st(), round, ["pepe", "teo", "flor"]).ok, false);
});

test("answer of different length is wrong; grade does not mutate", () => {
  const round = { seq: ["pepe", "teo", "flor"], reverse: false };
  const s = st(), copy = JSON.stringify(s);
  assert.strictEqual(Parade.grade(s, round, ["pepe", "teo"]).ok, false);
  assert.strictEqual(Parade.grade(s, round, ["pepe", "teo", "flor", "hugo"]).ok, false);
  assert.strictEqual(JSON.stringify(s), copy);
  assert.deepStrictEqual(round.seq, ["pepe", "teo", "flor"]);
});

test("correct cuts ms by 10 percent, floor 800", () => {
  const round = { seq: ["pepe", "teo"], reverse: false };
  assert.strictEqual(Parade.grade(st(), round, round.seq).state.ms, 1620);
  let s = st();
  for (let i = 0; i < 30; i++) s = Parade.grade(s, round, round.seq).state;
  assert.strictEqual(s.ms, 800);
});

test("wrong raises ms by 15 percent, cap 2000", () => {
  const round = { seq: ["pepe", "teo"], reverse: false };
  assert.strictEqual(Parade.grade(st({ ms: 1000 }), round, ["hugo", "hugo"]).state.ms, 1150);
  let s = st({ ms: 1900 });
  for (let i = 0; i < 5; i++) s = Parade.grade(s, round, ["hugo", "hugo"]).state;
  assert.strictEqual(s.ms, 2000);
});

test("grade treats a state without ms as 1800", () => {
  const round = { seq: ["pepe", "teo"], reverse: false };
  const s = { span: 3, okRun: 0, badRun: 0, count: 0 };
  assert.strictEqual(Parade.grade(s, round, round.seq).state.ms, 1620);
});

test("gridSize is span + 1, max 6", () => {
  assert.strictEqual(Parade.gridSize(2), 3);
  assert.strictEqual(Parade.gridSize(5), 6);
  assert.strictEqual(Parade.gridSize(9), 6);
});

test("upgrade without marker cuts span once", () => {
  const v2 = { span: 5, okRun: 1, badRun: 0, count: 7 };
  const a = Parade.upgrade(v2);
  assert.deepStrictEqual(a, { span: 4, ms: 1800, okRun: 1, badRun: 0, count: 7 });
  assert.strictEqual(Parade.upgrade({ span: 2 }).span, 2);
  assert.deepStrictEqual(Parade.upgrade(null, 2), Parade.init());
  assert.deepStrictEqual(Parade.upgrade(undefined), Parade.init());
});

test("upgrade with marker and no ms sets ms only", () => {
  const old = { span: 4, okRun: 0, badRun: 1, count: 9 };
  assert.deepStrictEqual(Parade.upgrade(old, 2), { span: 4, ms: 1800, okRun: 0, badRun: 1, count: 9 });
});

test("upgrade with marker and ms changes nothing", () => {
  const cur = { span: 4, ms: 1200, okRun: 0, badRun: 0, count: 9 };
  assert.strictEqual(Parade.upgrade(cur, 2), cur);
});

test("upgrade twice with the marker changes nothing more", () => {
  const a = Parade.upgrade({ span: 5, okRun: 0, badRun: 0, count: 3 });
  const b = Parade.upgrade(a, 2);
  assert.strictEqual(b, a);
  assert.strictEqual(b.span, 4);
  // an old tab drops ms and keeps the marker: the next load restores ms and keeps the span
  const { ms, ...old } = a;
  assert.deepStrictEqual(Parade.upgrade(old, 2), a);
});
