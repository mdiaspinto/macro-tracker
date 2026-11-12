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
