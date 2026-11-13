const test = require("node:test"); const assert = require("node:assert/strict");
const Demo = require("../demo.js"), Brain = require("../brain.js"), Shop = require("../shop.js"), Game = require("../game.js");

const TODAY = "2026-11-13", MONDAY = "2026-11-16";
let n = 0;
const makeUser = (name, lang, lean, bulk) => ({ id: "u" + (++n), name, lang, goal: "lean", targets: { lean, bulk }, foods: [], days: {}, weights: {}, weightUnit: "kg" });
const addDays = (s, k) => { const [y, m, d] = s.split("-").map(Number), dt = new Date(y, m - 1, d + k);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); };
const week = today => [-6, -5, -4, -3, -2, -1, 0].map(k => addDays(today, k));
const kcal = ms => ms.reduce((a, m) => a + m.ap * 4 + m.ac * 4 + m.af * 9, 0);

test("sampleUser: name, lang, demo targets, built today", () => {
  const u = Demo.sampleUser("Ana", "es", TODAY, makeUser);
  assert.equal(u.name, "Ana"); assert.equal(u.lang, "es"); assert.equal(u.goal, "lean");
  assert.deepEqual(u.targets, Demo.TARGETS); assert.equal(u.demoBuilt, TODAY); assert.equal(u.collectionBg, "plain");
});
test("sampleUser: 6 full days before today with 3-4 eaten meals, today has 2", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser), dates = week(TODAY);
  assert.deepEqual(Object.keys(u.days).sort(), dates);
  dates.slice(0, 6).forEach(d => { assert.ok(u.days[d].length >= 3 && u.days[d].length <= 4, d); assert.ok(u.days[d].every(m => m.eaten === true)); });
  assert.equal(u.days[TODAY].length, 2); assert.ok(u.days[TODAY].every(m => m.eaten === true));
});
test("sampleUser: each full day lands within 15% of 1940 kcal and at least 2 days earn a macro star", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser), dates = week(TODAY).slice(0, 6);
  dates.forEach(d => assert.ok(Math.abs(kcal(u.days[d]) - 1940) <= 0.15 * 1940, d));
  assert.ok(dates.filter(d => Game.dayStar(u, d)).length >= 2);
});
test("sampleUser: meals hit at least 6 brain food categories, plus one sweet and one fried", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser), tags = new Set();
  week(TODAY).forEach(d => u.days[d].forEach(m => m.brain.forEach(t => tags.add(t))));
  const food = ["greens", "veg", "berries", "nuts", "beans", "fish", "grains", "olive"];
  assert.ok(food.filter(t => tags.has(t)).length >= 6);
  assert.ok(tags.has("sweets")); assert.ok(tags.has("fried"));
});
test("sampleUser: EN and ES names of each sample meal carry the same brain tags", () => {
  const en = Demo.sampleUser("Ana", "en", TODAY, makeUser), es = Demo.sampleUser("Ana", "es", TODAY, makeUser);
  week(TODAY).forEach(d => en.days[d].forEach((m, i) => {
    const e = es.days[d][i];
    assert.deepEqual(m.brain.slice().sort(), e.brain.slice().sort(), m.name + " / " + e.name);
    assert.deepEqual(m.brain, Brain.detectTags(m.name)); assert.deepEqual(e.brain, Brain.detectTags(e.name));
  }));
});
test("sampleUser: today alone fills 3+ food categories and 2 habits (alive on a Monday)", () => {
  const u = Demo.sampleUser("Ana", "en", MONDAY, makeUser), w = Brain.weekScore(u, MONDAY);
  const food = ["greens", "veg", "berries", "nuts", "beans", "fish", "grains", "olive"];
  assert.ok(food.filter(id => w.counts[id] > 0).length >= 3);
  assert.equal(u.habits[MONDAY].walk, true); assert.equal(u.habits[MONDAY].sleep, true);
});
test("sampleUser: habits across the 7 dates are walk 5, sleep 6, strength 2, social 1, mind 2", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser), count = id => week(TODAY).filter(d => (u.habits[d] || {})[id] === true).length;
  assert.deepEqual({ walk: count("walk"), sleep: count("sleep"), strength: count("strength"), social: count("social"), mind: count("mind") },
    { walk: 5, sleep: 6, strength: 2, social: 1, mind: 2 });
});
test("sampleUser: weights are 72.0, 71.8, 71.6, 71.4 on TODAY-6, -4, -2, -1 and none today", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser);
  assert.deepEqual(u.weights, { [addDays(TODAY, -6)]: 72.0, [addDays(TODAY, -4)]: 71.8, [addDays(TODAY, -2)]: 71.6, [addDays(TODAY, -1)]: 71.4 });
});
test("sampleUser: balance is 0 and the free box is available", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser);
  assert.equal(Shop.balance(u, TODAY, Brain.lifetimePoints(u, TODAY)).balance, 0);
  assert.equal(Shop.freeAvailable(u), true);
});
test("sampleUser: deterministic", () => {
  const a = Demo.sampleUser("Ana", "en", TODAY, makeUser), b = Demo.sampleUser("Ana", "en", TODAY, makeUser);
  delete a.id; delete b.id; assert.deepEqual(a, b);
});
test("refresh: moves the week to the new today and keeps id, name, lang, pulls, backdrop, demoTourDone", () => {
  const u = Demo.sampleUser("Ana", "es", TODAY, makeUser), NEXT = "2026-11-20";
  u.shop.pulls.a = { c: "lulu-1", free: true, at: 1 }; u.shop.pulls.b = { c: "kiki-2", at: 2 };
  u.collectionBg = "confetti"; u.demoTourDone = true;
  const r = Demo.refresh(u, NEXT, makeUser);
  assert.equal(r.demoBuilt, NEXT); assert.ok(r.days["2026-11-19"].length > 0); assert.equal(r.days["2026-11-07"], undefined);
  assert.equal(r.id, u.id); assert.equal(r.name, "Ana"); assert.equal(r.lang, "es");
  assert.deepEqual(r.shop.pulls, u.shop.pulls); assert.equal(r.collectionBg, "confetti"); assert.equal(r.demoTourDone, true);
  assert.equal(Shop.balance(r, NEXT, Brain.lifetimePoints(r, NEXT)).balance, 0);
});
test("accountState: one user, demo name and lang, demo targets, no sample data", () => {
  const u = Demo.sampleUser("Ana", "es", TODAY, makeUser), s = Demo.accountState(u, TODAY, 2, makeUser), a = s.users[0];
  assert.equal(s.users.length, 1); assert.equal(s.activeId, a.id);
  assert.equal(a.name, "Ana"); assert.equal(a.lang, "es"); assert.deepEqual(a.targets, Demo.TARGETS);
  assert.deepEqual(a.days, {}); assert.deepEqual(a.weights, {}); assert.deepEqual(a.habits || {}, {}); assert.deepEqual(a.foods, []);
  assert.equal(a.tourSeen, true); assert.equal(a.tourSeenV, 2); assert.equal(a.collectionBg, "plain");
  assert.deepEqual(s.migrations, { clearedSeedFoods: true, setupProfiles: true, fixProfileTargets: true, profileFromBio: true });
});
test("accountState: all pulls survive and an unopened free box stays available", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser);
  assert.equal(Shop.freeAvailable(Demo.accountState(u, TODAY, 2, makeUser).users[0]), true);
  u.shop.pulls.a = { c: "lulu-1", free: true, at: 1 }; u.shop.pulls.b = { c: "kiki-2", at: 2 };
  const a = Demo.accountState(u, TODAY, 2, makeUser).users[0];
  assert.deepEqual(Object.keys(a.shop.pulls).sort(), ["a", "b"]); assert.equal(Shop.freeAvailable(a), false);
});
test("accountState: balance starts at 0 and later points count in full, even after a paid demo pull", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser);
  u.shop.pulls.a = { c: "lulu-1", free: true, at: 1 }; u.shop.pulls.b = { c: "kiki-2", at: 2 };
  const a = Demo.accountState(u, TODAY, 2, makeUser).users[0];
  assert.equal(Shop.balance(a, TODAY, 0).balance, 0); assert.equal(Shop.balance(a, TODAY, 120).balance, 120);
});
test("accountState: shop.start is today", () => {
  const u = Demo.sampleUser("Ana", "en", TODAY, makeUser);
  assert.equal(Demo.accountState(u, "2026-11-20", 2, makeUser).users[0].shop.start, "2026-11-20");
});
test("usernameFrom", () => {
  assert.equal(Demo.usernameFrom("Ana María"), "ana_maria");
  assert.equal(Demo.usernameFrom("José Ñ"), "jose_n");
  assert.equal(Demo.usernameFrom("  Bob  "), "bob");
  assert.equal(Demo.usernameFrom("<b>"), "");
  assert.equal(Demo.usernameFrom("Zoë 😀"), "zoe");
  assert.equal(Demo.usernameFrom("A".repeat(30)), "a".repeat(20));
});
test("hasRealData", () => {
  const empty = () => makeUser("x", "en", {}, {}), st = u => ({ users: [empty(), u] });
  assert.equal(Demo.hasRealData({ users: [empty(), empty()] }), false);
  assert.equal(Demo.hasRealData(st(Object.assign(empty(), { shop: { pulls: {} } }))), false);
  assert.equal(Demo.hasRealData(st(Object.assign(empty(), { days: { "2026-11-13": [{ name: "a" }] } }))), true);
  assert.equal(Demo.hasRealData(st(Object.assign(empty(), { weights: { "2026-11-13": 70 } }))), true);
  assert.equal(Demo.hasRealData(st(Object.assign(empty(), { foods: [{ name: "a" }] }))), true);
  assert.equal(Demo.hasRealData(st(Object.assign(empty(), { habits: { "2026-11-13": { walk: true } } }))), true);
  assert.equal(Demo.hasRealData(st(Object.assign(empty(), { shop: { pulls: { a: { c: "lulu-1", at: 1 } } } }))), true);
  assert.equal(Demo.hasRealData(null), false); assert.equal(Demo.hasRealData({}), false); assert.equal(Demo.hasRealData({ users: [] }), false);
});
