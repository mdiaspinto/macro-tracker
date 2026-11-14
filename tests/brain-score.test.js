const test = require("node:test");
const assert = require("node:assert");
const Score = require("../brain/score.js");

test("speedBonus: one question", () => {
  assert.strictEqual(Score.speedBonus(1000), 10);
  assert.strictEqual(Score.speedBonus(3000), 5);
  assert.strictEqual(Score.speedBonus(5000), 0);
  assert.strictEqual(Score.speedBonus(6000), 0);
  assert.strictEqual(Score.speedBonus(500), 10);
  assert.strictEqual(Score.speedBonus(499), 0);
  assert.strictEqual(Score.speedBonus(0), 0);
  assert.strictEqual(Score.speedBonus(-50), 0);
  assert.strictEqual(Score.speedBonus(NaN), 0);
  assert.strictEqual(Score.speedBonus(Infinity), 0);
  assert.strictEqual(Score.speedBonus(undefined), 0);
});

test("speedBonus: two questions", () => {
  assert.strictEqual(Score.speedBonus(2000, true), 10);
  assert.strictEqual(Score.speedBonus(1000, true), 10);
  assert.strictEqual(Score.speedBonus(999, true), 0);
  assert.strictEqual(Score.speedBonus(6000, true), 5);
  assert.strictEqual(Score.speedBonus(10000, true), 0);
});

test("peek", () => {
  assert.strictEqual(Score.peek({ ok: false, answerMs: 500, level: 1, step: 1 }), 0);
  assert.strictEqual(Score.peek({ ok: true, answerMs: 1000, level: 1, step: 1 }), 20);
  assert.strictEqual(Score.peek({ ok: true, answerMs: 3000, level: 1, step: 3 }), 23);
  assert.strictEqual(Score.peek({ ok: true, answerMs: 2000, level: 2, step: 5 }), 45);
  assert.strictEqual(Score.peek({ ok: true, answerMs: 1000 }), 20);
});

test("parade", () => {
  assert.strictEqual(Score.parade({ ok: false, span: 4 }), 0);
  assert.strictEqual(Score.parade({ ok: true, span: 4 }), 40);
  assert.strictEqual(Score.parade({ ok: true, span: 6, reverse: true }), 90);
});

test("names", () => {
  assert.strictEqual(Score.names({ ok: false, choices: 6 }), 0);
  assert.strictEqual(Score.names({ ok: true, choices: 4 }), 10);
  assert.strictEqual(Score.names({ ok: true, choices: 6 }), 15);
});

test("bestId", () => {
  assert.strictEqual(Score.bestId("peek", 3), "peek_3");
});

test("isBetter", () => {
  assert.strictEqual(Score.isBetter(10, undefined), true);
  assert.strictEqual(Score.isBetter(10, null), true);
  assert.strictEqual(Score.isBetter(50, { score: 50 }), false);
  assert.strictEqual(Score.isBetter(51, { score: 50 }), true);
  assert.strictEqual(Score.isBetter(NaN, { score: 50 }), false);
  assert.strictEqual(Score.isBetter(NaN, undefined), false);
  assert.strictEqual(Score.isBetter(0, { score: "high" }), true);
  assert.strictEqual(Score.isBetter(0, { score: NaN }), true);
  assert.strictEqual(Score.isBetter(0, {}), true);
  assert.strictEqual(Score.isBetter(NaN, {}), false);
});

test("peek: an answer faster than the minimum time gets no speed bonus", () => {
  assert.strictEqual(Score.peek({ ok: true, answerMs: 200, level: 1, step: 1 }), 10);
  assert.strictEqual(Score.peek({ ok: true, answerMs: 500, level: 1, step: 1 }), 20);
});
