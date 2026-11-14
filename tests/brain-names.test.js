const test = require("node:test");
const assert = require("node:assert");
const Names = require("../brain/names.js");

const mk = () => { let s = 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const CAST = Array.from({ length: 12 }, (_, i) => "c" + i);
const TODAY = "2026-11-14";

test("constants", () => {
  assert.strictEqual(Names.MIN_CAST, 12);
  assert.deepStrictEqual(Names.GAPS, [1, 3, 7, 14, 30]);
});

test("not available below 12", () => {
  assert.strictEqual(Names.available(CAST.slice(0, 11)), false);
  assert.strictEqual(Names.available(CAST), true);
});

test("intro gives 2 new cards then none the same day", () => {
  const p = Names.plan({}, CAST, TODAY);
  assert.deepStrictEqual(p.intro, ["c0", "c1"]);
  assert.deepStrictEqual(p.review, []);
  let cards = Names.grade({}, "c0", true, TODAY);
  cards = Names.grade(cards, "c1", true, TODAY);
  assert.deepStrictEqual(Names.plan(cards, CAST, TODAY).intro, []);
  assert.deepStrictEqual(Names.plan(cards, CAST, "2026-11-15").intro, ["c2", "c3"]);
});

test("plan is pure", () => {
  const cards = { c0: { box: 1, due: TODAY } };
  const snap = JSON.stringify(cards);
  Names.plan(cards, CAST, TODAY);
  assert.strictEqual(JSON.stringify(cards), snap);
});

test("review lists due cards oldest first, ties in cast order", () => {
  const cards = {
    c3: { box: 2, due: "2026-11-10" }, c1: { box: 1, due: "2026-11-14" },
    c2: { box: 1, due: "2026-11-10" }, c5: { box: 1, due: "2026-11-15" },
  };
  assert.deepStrictEqual(Names.plan(cards, CAST, TODAY).review, ["c2", "c3", "c1"]);
});

test("metadata keys are skipped", () => {
  const cards = { _introDay: "2026-11-01", _x: { box: 1, due: "2020-01-01" }, c0: { box: 1, due: TODAY } };
  const p = Names.plan(cards, CAST, TODAY);
  assert.deepStrictEqual(p.review, ["c0"]);
  assert.deepStrictEqual(p.intro, ["c1", "c2"]);
});

test("correct moves up a box with the right gap", () => {
  const out = Names.grade({ c0: { box: 2, due: TODAY } }, "c0", true, TODAY);
  assert.deepStrictEqual(out.c0, { box: 3, due: "2026-11-21" });
});

test("gap crosses a month and year end", () => {
  const out = Names.grade({ c0: { box: 3, due: "2026-12-20" } }, "c0", true, "2026-12-20");
  assert.deepStrictEqual(out.c0, { box: 4, due: "2027-01-03" });
});

test("box stays at 5 with 30-day gap", () => {
  const out = Names.grade({ c0: { box: 5, due: TODAY } }, "c0", true, TODAY);
  assert.deepStrictEqual(out.c0, { box: 5, due: "2026-12-14" });
});

test("wrong returns to box 1 due today", () => {
  const out = Names.grade({ c0: { box: 4, due: TODAY } }, "c0", false, TODAY);
  assert.deepStrictEqual(out.c0, { box: 1, due: TODAY });
});

test("grade returns a new object and never mutates input", () => {
  const cards = { c0: { box: 1, due: TODAY } };
  const snap = JSON.stringify(cards);
  const out = Names.grade(cards, "c0", true, TODAY);
  assert.notStrictEqual(out, cards);
  assert.strictEqual(JSON.stringify(cards), snap);
});

test("intro grade creates the card and sets _introDay", () => {
  const ok = Names.grade({}, "c4", true, TODAY);
  assert.deepStrictEqual(ok.c4, { box: 1, due: "2026-11-15" });
  assert.strictEqual(ok._introDay, TODAY);
  const bad = Names.grade({}, "c4", false, TODAY);
  assert.deepStrictEqual(bad.c4, { box: 1, due: TODAY });
  assert.strictEqual(bad._introDay, TODAY);
});

test("grading an existing card does not set _introDay", () => {
  const out = Names.grade({ c0: { box: 1, due: TODAY } }, "c0", true, TODAY);
  assert.strictEqual("_introDay" in out, false);
});

test("choices has 4 unique ids including the answer", () => {
  const rng = mk();
  for (let i = 0; i < 30; i++) {
    const c = Names.choices("c5", CAST, rng);
    assert.strictEqual(c.length, 4);
    assert.strictEqual(new Set(c).size, 4);
    assert.ok(c.includes("c5"));
    c.forEach((id) => assert.ok(CAST.includes(id)));
  }
});

test("choices returns all ids when the cast is under 4", () => {
  const c = Names.choices("a", ["a", "b", "c"], mk());
  assert.deepStrictEqual(c.slice().sort(), ["a", "b", "c"]);
});

test("choices with n=6", () => {
  const out = Names.choices("c3", CAST, mk(), 6);
  assert.strictEqual(out.length, 6);
  assert.strictEqual(new Set(out).size, 6);
  assert.ok(out.includes("c3"));
  assert.strictEqual(Names.choices("c3", CAST.slice(0, 5), mk(), 6).length, 5);
});

test("startRun reads _choices and defaults to 4", () => {
  assert.deepStrictEqual(Names.startRun({}), { choices: 4, okRun: 0, badRun: 0 });
  assert.strictEqual(Names.startRun({ _choices: 6 }).choices, 6);
  assert.strictEqual(Names.startRun({ _choices: 5 }).choices, 4);
});

test("adapt 5 correct goes to 6", () => {
  let r = Names.startRun({});
  for (let i = 0; i < 4; i++) r = Names.adapt(r, true);
  assert.deepStrictEqual(r, { choices: 4, okRun: 4, badRun: 0 });
  r = Names.adapt(r, true);
  assert.deepStrictEqual(r, { choices: 6, okRun: 0, badRun: 0 });
});

test("adapt 2 wrong at 6 goes to 4", () => {
  let r = Names.adapt({ choices: 6, okRun: 0, badRun: 0 }, false);
  assert.deepStrictEqual(r, { choices: 6, okRun: 0, badRun: 1 });
  r = Names.adapt(r, false);
  assert.deepStrictEqual(r, { choices: 4, okRun: 0, badRun: 0 });
});

test("adapt resets runs on change", () => {
  let r = Names.adapt({ choices: 4, okRun: 3, badRun: 0 }, false);
  assert.deepStrictEqual(r, { choices: 4, okRun: 0, badRun: 1 });
  r = Names.adapt({ choices: 6, okRun: 2, badRun: 1 }, true);
  assert.deepStrictEqual(r, { choices: 6, okRun: 3, badRun: 0 });
  const src = { choices: 4, okRun: 4, badRun: 0 };
  Names.adapt(src, true);
  assert.deepStrictEqual(src, { choices: 4, okRun: 4, badRun: 0 });
});

test("saveChoices does not mutate", () => {
  const cards = { c0: { box: 1, due: TODAY } };
  const out = Names.saveChoices(cards, 6);
  assert.strictEqual(out._choices, 6);
  assert.strictEqual(out.c0, cards.c0);
  assert.strictEqual("_choices" in cards, false);
});

test("practice orders by due and skips _ keys", () => {
  const cards = {
    _choices: 4, _introDay: TODAY,
    c2: { box: 1, due: "2026-12-01" }, c1: { box: 1, due: "2026-11-20" },
    c4: { box: 1, due: "2026-11-20" }, c0: { box: 3, due: "2026-11-30" },
  };
  assert.deepStrictEqual(Names.practice(cards, CAST, 3), ["c1", "c4", "c0"]);
  assert.deepStrictEqual(Names.practice(cards, CAST, 10), ["c1", "c4", "c0", "c2"]);
  assert.deepStrictEqual(Names.practice({}, CAST, 3), []);
});

test("cards for ids not in the cast are ignored", () => {
  const cards = { rosa: { box: 1, due: "2026-11-01" }, luna: { box: 2, due: "2026-11-02" }, c0: { box: 1, due: "2026-11-01" } };
  const p = Names.plan(cards, CAST, TODAY);
  assert.deepStrictEqual(p.review, ["c0"]);
  assert.ok(p.intro.indexOf("rosa") < 0 && p.intro.indexOf("luna") < 0);
  assert.deepStrictEqual(Names.practice(cards, CAST, 5), ["c0"]);
});

test("first game introduces 2 and _introN counts them", () => {
  let cards = {};
  Names.plan(cards, CAST, TODAY).intro.forEach((id) => { cards = Names.grade(cards, id, true, TODAY); });
  assert.strictEqual(cards._introN, 2);
  assert.strictEqual(Names.DAILY_NEW, 5);
});

test("extraIntro returns the next uncarded id until 5 are introduced", () => {
  let cards = {};
  Names.plan(cards, CAST, TODAY).intro.forEach((id) => { cards = Names.grade(cards, id, true, TODAY); });
  for (let n = 2; n < 5; n++) {
    const id = Names.extraIntro(cards, CAST, TODAY);
    assert.strictEqual(id, "c" + n);
    cards = Names.grade(cards, id, true, TODAY);
    assert.strictEqual(cards._introN, n + 1);
  }
  assert.strictEqual(Names.extraIntro(cards, CAST, TODAY), null);
});

test("a new day resets the intro count", () => {
  const cards = { _introDay: "2026-11-13", _introN: 5, c0: { box: 1, due: TODAY } };
  assert.strictEqual(Names.extraIntro(cards, CAST, TODAY), "c1");
  const out = Names.grade(cards, "c1", true, TODAY);
  assert.strictEqual(out._introN, 1);
  assert.strictEqual(out._introDay, TODAY);
});

test("old saved cards without _introN count as 2 today", () => {
  const cards = { _introDay: TODAY, c0: { box: 1, due: TODAY }, c1: { box: 1, due: TODAY } };
  assert.strictEqual(Names.extraIntro(cards, CAST, TODAY), "c2");
  assert.strictEqual(Names.grade(cards, "c2", true, TODAY)._introN, 3);
});

test("extraIntro never introduces ids outside the cast and returns null when none are left", () => {
  const cards = { rosa: { box: 1, due: TODAY }, _introDay: TODAY, _introN: 2 };
  assert.strictEqual(Names.extraIntro(cards, CAST, TODAY), "c0");
  const all = {};
  CAST.forEach((id) => { all[id] = { box: 1, due: TODAY }; });
  all._introDay = TODAY; all._introN = 2;
  assert.strictEqual(Names.extraIntro(all, CAST, TODAY), null);
});
