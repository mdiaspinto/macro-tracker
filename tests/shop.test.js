const test = require("node:test"); const assert = require("node:assert/strict");
const Shop = require("../shop.js");
const rngOf = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const commons = Shop.CHARACTERS.filter(c => c.tier === "common").map(c => c.id);
const secrets = Shop.CHARACTERS.filter(c => c.tier === "secret").map(c => c.id);

test("catalogue: 24 commons in 4 collections of 6, 20 secrets, unique ids, EN+ES names", () => {
  assert.equal(commons.length, 24); assert.equal(secrets.length, 20);
  for (const col of ["lulu", "kiki", "momo", "nini"]) assert.equal(Shop.CHARACTERS.filter(c => c.col === col).length, 6);
  assert.equal(new Set(Shop.CHARACTERS.map(c => c.id)).size, 44);
  assert.ok(Shop.CHARACTERS.every(c => c.en && c.es && c.img));
  assert.equal(Shop.byId("lulu-1").en, "Gym"); assert.equal(Shop.byId("nini-6").es, "Ratón de biblioteca");
  assert.equal(Shop.byId("s16").en, "Netherlands"); assert.equal(Shop.byId("s16").img, "img/s/16.webp");
});
test("draw: ~25% secrets and no duplicates from an empty shelf", () => {
  const rng = rngOf(1); let s = 0;
  for (let i = 0; i < 10000; i++) { const r = Shop.draw([], rng); assert.equal(r.dup, false); if (r.id[0] === "s") s++; }
  assert.ok(s > 2300 && s < 2700, s);
});
test("draw: ~10% duplicates when both owned and unowned exist in the tier", () => {
  const rng = rngOf(2), owned = commons.slice(0, 12).concat(secrets.slice(0, 10)); let d = 0;
  for (let i = 0; i < 10000; i++) { const r = Shop.draw(owned, rng); if (r.dup) { d++; assert.ok(owned.includes(r.id)); } else assert.ok(!owned.includes(r.id)); }
  assert.ok(d > 850 && d < 1150, d);
});
test("draw: a full tier falls through to the other tier", () => {
  const rng = rngOf(3);
  for (let i = 0; i < 500; i++) { const r = Shop.draw(secrets, rng); assert.ok(r.id[0] !== "s" && !r.dup); }  // no commons owned -> never a dup
  for (let i = 0; i < 500; i++) { const r = Shop.draw(commons, rng); assert.ok(r.id[0] === "s" && !r.dup); }
});
test("draw: everything owned -> always a duplicate", () => {
  const rng = rngOf(4), all = commons.concat(secrets);
  for (let i = 0; i < 200; i++) assert.equal(Shop.draw(all, rng).dup, true);
});
test("draw: noDup never returns an owned character", () => {
  const rng = rngOf(5), owned = commons.slice(0, 3);
  for (let i = 0; i < 2000; i++) assert.equal(Shop.draw(owned, rng, { noDup: true }).dup, false);
});

const U = (weights, goal = "lean", shop = { start: "2026-11-02", startPoints: 100, pulls: {} }) => ({ goal, weights, shop });
test("weightPoints: +10 per weigh-in date, max 3 per Mon–Sun week, dates before start ignored", () => {
  const w = { "2026-11-01": 70, "2026-11-02": 70, "2026-11-03": 70, "2026-11-04": 70, "2026-11-05": 70, "2026-11-10": 70 };
  assert.equal(Shop.weightPoints(U(w), "2026-11-11").total, 30 + 10);   // 11-01 is before start; week 1 capped at 3
  assert.equal(Shop.weightPoints(U(w), "2026-11-11").thisWeek, 10);
});
test("weightPoints: pace bonus at inclusive boundaries, lean and bulk", () => {
  const two = (a, b) => ({ "2026-11-02": a, "2026-11-09": b });          // one entry in each of two weeks
  const at = "2026-11-16";                                               // week of 11-09 is complete
  assert.equal(Shop.weightPoints(U(two(100, 99.75)), at).total, 20 + 40); // −0.25 %
  assert.equal(Shop.weightPoints(U(two(100, 99)), at).total, 20 + 40);    // −1.0 %
  assert.equal(Shop.weightPoints(U(two(100, 98.9)), at).total, 20);       // too fast
  assert.equal(Shop.weightPoints(U(two(100, 99.8)), at).total, 20);       // too slow
  assert.equal(Shop.weightPoints(U(two(100, 100.3)), at).total, 20);      // wrong direction for lean
  assert.equal(Shop.weightPoints(U(two(100, 100.1), "bulk"), at).total, 20 + 40);
  assert.equal(Shop.weightPoints(U(two(100, 100.5), "bulk"), at).total, 20 + 40);
  assert.equal(Shop.weightPoints(U(two(100, 100.6), "bulk"), at).total, 20);
});
test("weightPoints: no bonus for the current week or a week without a previous-week entry", () => {
  assert.equal(Shop.weightPoints(U({ "2026-11-02": 100, "2026-11-09": 99.5 }), "2026-11-12").total, 20);  // week of 11-09 not complete
  assert.equal(Shop.weightPoints(U({ "2026-11-09": 99.5 }), "2026-11-16").total, 10);
});
test("balance: free box costs nothing, duplicates refund 50, brain counted from startPoints", () => {
  const u = U({}); u.shop.pulls = { a: { c: "lulu-1", at: 1, free: true }, b: { c: "kiki-1", at: 2 }, c: { c: "kiki-1", at: 3, dup: true } };
  assert.deepEqual(Shop.balance(u, "2026-11-11", 600), { balance: 500 - 400 + 50, brain: 500, weight: 0, spent: 350 });
});
test("balance: floors at 0 when lifetime drops below startPoints", () => {
  const u = U({}); u.shop.pulls = { b: { c: "kiki-1", at: 2 } };
  assert.equal(Shop.balance(u, "2026-11-11", 50).balance, 0);
});
test("owned/progress/secretsFound/freeAvailable tolerate a missing shop", () => {
  assert.deepEqual(Shop.owned({}), []); assert.equal(Shop.freeAvailable({}), false);
  assert.deepEqual(Shop.progress({}, "lulu"), { have: 0, total: 6 }); assert.deepEqual(Shop.secretsFound({}), []);
  const u = U({}); assert.equal(Shop.freeAvailable(u), true);
  Shop.addPull(u, { id: "s03", dup: false }, true, 5, () => 0.5);
  assert.equal(Shop.freeAvailable(u), false); assert.deepEqual(Shop.secretsFound(u), ["s03"]);
  assert.deepEqual(Shop.owned(u), ["s03"]);
});
test("mergeShop: concurrent pulls from two devices both survive", () => {
  const a = { start: "2026-11-02", startPoints: 100, pulls: { k1: { c: "lulu-1", at: 1 } } };
  const b = { start: "2026-11-02", startPoints: 100, pulls: { k2: { c: "kiki-2", at: 2 } } };
  const m = Shop.mergeShop(a, b);
  assert.deepEqual(Object.keys(m.pulls).sort(), ["k1", "k2"]);
  assert.equal(Shop.balance({ goal: "lean", weights: {}, shop: m }, "2026-11-11", 500).spent, 400);
});
test("mergeShop: earliest start wins with its startPoints; missing sides", () => {
  const a = { start: "2026-11-05", startPoints: 900, pulls: {} }, b = { start: "2026-11-02", startPoints: 100 };
  assert.deepEqual(Shop.mergeShop(a, b), { start: "2026-11-02", startPoints: 100, pulls: {} });
  assert.equal(Shop.mergeShop(undefined, undefined), undefined);
  assert.deepEqual(Shop.mergeShop(undefined, a), a);
});
test("weightPoints: pace means use every entry in the week, even before start; points do not", () => {
  const w = { "2026-10-27": 100, "2026-11-02": 99.5, "2026-11-05": 99.9 };  // 11-02 is before start 11-04, inside the launch week
  const u = U(w, "lean", { start: "2026-11-04", startPoints: 100, pulls: {} });
  assert.equal(Shop.weightPoints(u, "2026-11-09").total, 10 + 40);   // launch-week mean 99.7 -> -0.3 % (old in-window-only mean 99.9 -> -0.1 %: no bonus)
  assert.equal(Shop.weightPoints(u, "2026-11-09").thisWeek, 0);
});
