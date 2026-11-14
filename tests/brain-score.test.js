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

test("bestId is the game name", () => {
  assert.strictEqual(Score.bestId("peek"), "peek");
});

test("rating", () => {
  assert.strictEqual(Score.rating(300, 1), 300);
  assert.strictEqual(Score.rating(560, 2), 308);
  assert.strictEqual(Score.rating(780, 3), 312);
  assert.strictEqual(Score.rating(0, 2), 0);
  assert.strictEqual(Score.rating(500, 5), 140);
  assert.strictEqual(Score.rating(NaN, 2), 0);
  assert.strictEqual(Score.rating(Infinity, 2), 0);
  assert.strictEqual(Score.rating(100, 0), 0);
  assert.strictEqual(Score.rating(100, 6), 0);
  assert.strictEqual(Score.rating(100, NaN), 0);
});

test("migrateBest converts old records and keeps the highest", () => {
  const r = Score.migrateBest({ peek_1: { score: 300, at: 1 }, peek_3: { score: 780, at: 2 } });
  assert.deepStrictEqual(r, { peek: { score: 312, points: 780, len: 3, at: 2 } });
  assert.deepStrictEqual(Score.migrateBest({ peek_5: { score: 500, at: 4 } }),
    { peek: { score: 140, points: 500, len: 5, at: 4 } });
});

test("migrateBest keeps a valid new-id record over any old one", () => {
  const input = { peek: { score: 10, points: 10, len: 1, at: 9 }, peek_3: { score: 780, at: 2 } };
  assert.deepStrictEqual(Score.migrateBest(input), { peek: input.peek });
});

test("migrateBest ignores bad records and handles empty input", () => {
  assert.deepStrictEqual(Score.migrateBest(null), {});
  assert.deepStrictEqual(Score.migrateBest(undefined), {});
  assert.deepStrictEqual(Score.migrateBest({ peek_1: null, peek_2: "x", parade_1: { score: NaN }, names_1: { score: -5 }, names_2: {} }), {});
  const r = Score.migrateBest({ peek: { score: "bad" }, peek_1: { score: 100, at: 1 } });
  assert.strictEqual(r.peek.score, 100);
});

test("migrateBest breaks a rating tie with the longer length and does not mutate", () => {
  // rating(100,1)=100 and rating(x,2): 110/2*1.1 = 60.5 -> use 182/2*1.1=100.1 -> 100
  const input = { parade_1: { score: 100, at: 1 }, parade_2: { score: 182, at: 2 } };
  const copy = JSON.parse(JSON.stringify(input));
  const r = Score.migrateBest(input);
  assert.strictEqual(r.parade.len, 2);
  assert.deepStrictEqual(input, copy);
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
