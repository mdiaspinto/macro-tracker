const test = require("node:test");
const assert = require("node:assert");
const Parade = require("../brain/parade.js");

const mk = () => { let s = 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const IDS = ["coco", "teo", "rosa", "luna"];
const st = (o) => Object.assign(Parade.init(), o);

test("init values", () => {
  assert.deepStrictEqual(Parade.init(), { span: 3, okRun: 0, badRun: 0, count: 0 });
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
  const round = { seq: ["coco", "teo", "rosa"], reverse: false };
  const a = Parade.grade(st(), round, round.seq);
  assert.strictEqual(a.ok, true);
  assert.deepStrictEqual(a.state, { span: 3, okRun: 1, badRun: 0, count: 1 });
  const b = Parade.grade(a.state, round, round.seq);
  assert.deepStrictEqual(b.state, { span: 4, okRun: 0, badRun: 0, count: 2 });
});

test("two wrong shrink span, min 2", () => {
  const round = { seq: ["coco", "teo", "rosa"], reverse: false };
  const bad = ["luna", "luna", "luna"];
  const a = Parade.grade(st(), round, bad);
  assert.strictEqual(a.ok, false);
  assert.deepStrictEqual(a.state, { span: 3, okRun: 0, badRun: 1, count: 1 });
  const b = Parade.grade(a.state, round, bad);
  assert.deepStrictEqual(b.state, { span: 2, okRun: 0, badRun: 0, count: 2 });
  const c = Parade.grade(Parade.grade(b.state, round, bad).state, round, bad);
  assert.strictEqual(c.state.span, 2);
});

test("a wrong answer resets okRun and a correct one resets badRun", () => {
  const round = { seq: ["coco", "teo", "rosa"], reverse: false };
  const bad = ["teo", "coco", "rosa"];
  const a = Parade.grade(st({ okRun: 1 }), round, bad);
  assert.strictEqual(a.state.okRun, 0);
  assert.strictEqual(a.state.badRun, 1);
  const b = Parade.grade(st({ badRun: 1 }), round, round.seq);
  assert.strictEqual(b.state.badRun, 0);
  assert.strictEqual(b.state.okRun, 1);
});

test("reverse answer graded against reversed seq", () => {
  const round = { seq: ["coco", "teo", "rosa"], reverse: true };
  assert.strictEqual(Parade.grade(st(), round, ["rosa", "teo", "coco"]).ok, true);
  assert.strictEqual(Parade.grade(st(), round, ["coco", "teo", "rosa"]).ok, false);
});

test("answer of different length is wrong; grade does not mutate", () => {
  const round = { seq: ["coco", "teo", "rosa"], reverse: false };
  const s = st(), copy = JSON.stringify(s);
  assert.strictEqual(Parade.grade(s, round, ["coco", "teo"]).ok, false);
  assert.strictEqual(Parade.grade(s, round, ["coco", "teo", "rosa", "luna"]).ok, false);
  assert.strictEqual(JSON.stringify(s), copy);
  assert.deepStrictEqual(round.seq, ["coco", "teo", "rosa"]);
});
