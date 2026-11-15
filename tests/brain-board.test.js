const test = require("node:test");
const assert = require("node:assert");
const Board = require("../brain/board.js");

test("GAMES and entryKey", () => {
  assert.deepStrictEqual(Board.GAMES, ["peek", "parade", "names"]);
  assert.strictEqual(Board.entryKey("u1", "mama"), "u1_mama");
});

test("row: cuts a 50-character name to 40", () => {
  const r = Board.row({ score: 100, at: 5 }, "x".repeat(50), 9);
  assert.strictEqual(r.name.length, 40);
});

test("row: trims the name, keeps best.at", () => {
  assert.deepStrictEqual(Board.row({ score: 100, at: 5 }, "  Ana ", 9), { name: "Ana", score: 100, at: 5 });
});

test("row: no at uses now", () => {
  assert.strictEqual(Board.row({ score: 100 }, "Ana", 9).at, 9);
});

test("row: no valid best gives null", () => {
  assert.strictEqual(Board.row(null, "Ana", 9), null);
  assert.strictEqual(Board.row({}, "Ana", 9), null);
  assert.strictEqual(Board.row({ score: NaN }, "Ana", 9), null);
});

test("needsWrite", () => {
  const row = { name: "Ana", score: 100, at: 1 };
  assert.strictEqual(Board.needsWrite(row, null), true);
  assert.strictEqual(Board.needsWrite(row, { name: "Ana", score: 90, at: 1 }), true);
  assert.strictEqual(Board.needsWrite(row, { name: "Ana", score: 100, at: 1 }), false);
  assert.strictEqual(Board.needsWrite(row, { name: "Ann", score: 100, at: 1 }), true);
});

test("rank: score desc, tie by earlier at, missing at last", () => {
  const rows = {
    a: { name: "A", score: 50, at: 3 },
    b: { name: "B", score: 80, at: 9 },
    c: { name: "C", score: 50, at: 1 },
    d: { name: "D", score: 50 },
    e: { name: "E", score: "x", at: 1 },
  };
  const r = Board.rank(rows, "a", 10);
  assert.deepStrictEqual(r.top.map((x) => x.key), ["b", "c", "a", "d"]);
  assert.deepStrictEqual(r.top.map((x) => x.rank), [1, 2, 3, 4]);
  assert.deepStrictEqual(r.top.map((x) => x.me), [false, false, true, false]);
  assert.strictEqual(r.me, null);
});

test("rank: me is set outside the top", () => {
  const rows = {};
  for (let i = 1; i <= 12; i++) rows["k" + i] = { name: "N" + i, score: 100 - i, at: i };
  const r = Board.rank(rows, "k12", 10);
  assert.strictEqual(r.top.length, 10);
  assert.deepStrictEqual(r.me, { key: "k12", name: "N12", score: 88, rank: 12 });
});

test("rank: empty input", () => {
  assert.deepStrictEqual(Board.rank(null, "a", 10), { top: [], me: null });
});

test("staleKeys keeps current profiles and other accounts", () => {
  const rows = { u1_mama: {}, u1_old: {}, u2_old: {}, u10_x: {} };
  assert.deepStrictEqual(Board.staleKeys(rows, "u1", ["mama"]), ["u1_old"]);
  assert.deepStrictEqual(Board.staleKeys(null, "u1", []), []);
});

test("needsWrite: remote higher with the same name needs no write", () => {
  const row = { name: "Ana", score: 100, at: 5 };
  assert.strictEqual(Board.needsWrite(row, { name: "Ana", score: 150, at: 1 }), false);
});

test("needsWrite: remote higher with another name still needs a write", () => {
  const row = { name: "Ana", score: 100, at: 5 };
  assert.strictEqual(Board.needsWrite(row, { name: "Ann", score: 150, at: 1 }), true);
});

test("toWrite: name differs, remote higher keeps the remote score and at", () => {
  const row = { name: "Ana", score: 100, at: 5 };
  assert.deepStrictEqual(Board.toWrite(row, { name: "Ann", score: 150, at: 1 }), { name: "Ana", score: 150, at: 1 });
});

test("toWrite: remote higher without a valid at keeps the local at", () => {
  const row = { name: "Ana", score: 100, at: 5 };
  assert.deepStrictEqual(Board.toWrite(row, { name: "Ann", score: 150 }), { name: "Ana", score: 150, at: 5 });
});

test("toWrite: missing or lower remote writes the local row; no write gives null", () => {
  const row = { name: "Ana", score: 100, at: 5 };
  assert.deepStrictEqual(Board.toWrite(row, null), row);
  assert.deepStrictEqual(Board.toWrite(row, { name: "Ana", score: 90, at: 1 }), row);
  assert.strictEqual(Board.toWrite(row, { name: "Ana", score: 100, at: 5 }), null);
  assert.strictEqual(Board.toWrite(row, { name: "Ana", score: 150, at: 1 }), null);
});
