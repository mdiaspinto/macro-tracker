const test = require("node:test"); const assert = require("node:assert/strict");
const Brain = require("../brain.js");
const has = (name, ...tags) => tags.forEach(t => assert.ok(Brain.detectTags(name).includes(t), `${name} → ${t}`));
const hasnt = (name, tag) => assert.ok(!Brain.detectTags(name).includes(tag), `${name} ↛ ${tag}`);

test("detects in EN/ES/FR with accents", () => {
  has("Grilled salmon", "fish", "oilyFish");
  has("Salmón a la plancha", "fish", "oilyFish");
  has("2 pavés de saumon atlantique bio", "fish", "oilyFish");
  has("Ensalada de espinacas y nueces", "greens", "nuts");
  has("Lentilles corail", "beans");
  has("Blueberries", "berries"); has("fresas", "berries");
});
test("multi-word phrases", () => {
  has("tostada con aceite de oliva", "olive");
  has("huile d'olive", "olive");
  has("pan integral", "grains");
});
test("whole words only", () => { hasnt("peanut butter", "veg"); hasnt("pineapple", "veg"); has("peanut butter", "nuts"); });
test("nut butters are nuts, not butter", () => {
  has("peanut butter", "nuts"); hasnt("peanut butter", "butter"); has("tostada con mantequilla", "butter");
  has("mantequilla de cacahuete", "nuts"); hasnt("mantequilla de cacahuete", "butter");
  has("beurre de cacahuete", "nuts"); hasnt("beurre de cacahuete", "butter");
});
test("white fish is fish but not oily", () => { has("Merluza", "fish"); hasnt("Merluza", "oilyFish"); });
test("tuna is fish only; plain rice/bread are not whole grains; potato is not veg", () => {
  has("tuna", "fish"); hasnt("tuna", "oilyFish");
  hasnt("white rice", "grains"); hasnt("pasta", "grains"); hasnt("bread", "grains"); has("flocons d'avoine", "grains");
  hasnt("potato", "veg");
});
test("limit foods", () => { has("Croissant", "sweets"); has("Papas fritas", "fried"); has("4 biftecks hachés bio, pur bœuf", "redMeat"); });
test("messy input never throws", () => {
  assert.deepEqual(Brain.detectTags(""), []);
  assert.deepEqual(Brain.detectTags(undefined), []);
  has("Salmón (bio) 🐟", "fish"); has("SPINACH-salad", "greens");
});
test("no wine category", () => assert.ok(!Brain.CATEGORIES.some(c => c.id === "wine")));
test("generic words do not misclassify", () => {
  hasnt("Salt and pepper chicken", "veg"); hasnt("poulet au poivre", "veg");
  hasnt("shepherd's pie", "sweets"); hasnt("oat milk latte", "grains");
  hasnt("Poulet viande blanche", "redMeat");
  hasnt("leche de almendras", "nuts"); hasnt("lait d'avoine", "grains");
});
test("positives still work", () => {
  has("bell pepper", "veg"); has("poivron rouge", "veg"); has("apple pie", "sweets");
  has("oats", "grains"); has("porridge", "grains"); has("viande hachée", "redMeat");
});
test("ligatures", () => {
  has("bœuf bourguignon", "redMeat");
  assert.equal(Brain.normalize("bœuf"), "boeuf");
});
test("peppers plural and soy milk", () => {
  has("Stuffed peppers", "veg"); has("mixed peppers", "veg");
  hasnt("leche de soja", "beans"); hasnt("lait de soja", "beans"); hasnt("soy milk latte", "beans");
});

const m = (name, eaten = true, extra = {}) => ({ id: name + Math.random(), name, eaten, ap: 0, ac: 0, af: 0, ...extra });
const mk = (days, habits) => ({ days, habits, targets: { lean: { p: 100, c: 100, f: 50 } }, goal: "lean" });

test("weekStart is local Monday", () => {
  assert.equal(Brain.weekStart("2026-11-15"), "2026-11-09"); // Sunday
  assert.equal(Brain.weekStart("2026-11-09"), "2026-11-09"); // Monday
  assert.equal(Brain.weekStart("2026-11-16"), "2026-11-16");
});
test("fill caps at target; what-if ignored", () => {
  const u = mk({"2026-11-10":[m("salmon"),m("salmon"),m("salmon"),m("sardines",false)]});
  const s = Brain.weekScore(u, "2026-11-11");
  assert.equal(s.counts.fish, 3); assert.equal(s.fill.fish, 1); assert.equal(s.oily, 3);
});
test("points formula", () => {
  const u = mk({"2026-11-10":[m("salmon")]});
  // fish 1/2 → 0.5 × 30 = 15, +5 oily, not full, not clean (1 meal)
  assert.equal(Brain.weekScore(u, "2026-11-10").points, 20);
});
test("explicit chips beat detection", () => {
  const u = mk({"2026-11-10":[m("mystery bowl", true, {brain:["nuts"]})]});
  assert.equal(Brain.weekScore(u, "2026-11-10").counts.nuts, 1);
});
test("habits: only true counts", () => {
  const u = mk({}, {"2026-11-10":{strength:true, walk:false}});
  const s = Brain.weekScore(u, "2026-11-10");
  assert.equal(s.counts.strength, 1); assert.equal(s.counts.walk, 0);
});
test("full bar: +50, clean +30, oily capped at 2, nextHint null", () => {
  const days = {}, habits = {};
  const week = ["2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13","2026-11-14","2026-11-15"];
  week.forEach((d, i) => {
    const tags = ["grains","veg","olive"];
    if (i < 6) tags.push("greens"); if (i < 5) tags.push("nuts"); if (i < 3) tags.push("beans");
    if (i < 2) tags.push("berries", "fish", "oilyFish"); if (i === 2) tags.push("fish", "oilyFish"); // 3 oily, capped at 2
    days[d] = [m("x", true, {brain: tags}), m("y", true, {brain:["grains"]}), m("z", true, {brain:["grains"]})];
    habits[d] = {sleep:true, strength: i < 2, walk: i < 5, social: i < 3, mind: i < 3};
  });
  const s = Brain.weekScore(mk(days, habits), "2026-11-12");
  assert.equal(s.bar, 1); assert.equal(s.full, true); assert.equal(s.clean, true);
  assert.equal(s.points, 390 + 10 + 50 + 30); assert.equal(s.nextHint, null);
});
test("clean week needs ≥7 meals and limits respected", () => {
  const seven = {}; ["09","10","11","12","13","14","15"].forEach(d => seven["2026-11-"+d] = [m("rice")]);
  assert.equal(Brain.weekScore(mk(seven), "2026-11-10").clean, true);
  const fried = structuredClone(seven); fried["2026-11-10"].push(m("a",true,{brain:["fried"]}), m("b",true,{brain:["fried"]}));
  assert.equal(Brain.weekScore(mk(fried), "2026-11-10").clean, false);
  const six = structuredClone(seven); delete six["2026-11-15"];
  assert.equal(Brain.weekScore(mk(six), "2026-11-10").clean, false);
});
test("nextHint picks closest unfilled", () => {
  assert.deepEqual(Brain.weekScore(mk({"2026-11-10":[m("salmon")]}), "2026-11-10").nextHint, {id:"fish", remaining:1});
});
test("lifetime sums weeks; empty user is 0", () => {
  const u = mk({"2026-11-03":[m("salmon")], "2026-11-10":[m("salmon")]});
  assert.equal(Brain.lifetimePoints(u, "2026-11-11"), 40);
  assert.equal(Brain.lifetimePoints({}, "2026-11-11"), 0);
});
test("levels", () => {
  assert.equal(Brain.levelFor(0).level.id, "sprout");
  assert.equal(Brain.levelFor(1500).level.id, "sharp");
  assert.equal(Brain.levelFor(1499).toNext, 1);
  assert.equal(Brain.levelFor(20000).next, null);
});
test("missing fields never throw", () => { assert.equal(Brain.weekScore({}, "2026-11-10").points, 0); });
test("malformed day data never throws", () => {
  [{days:{"2026-11-10":[null]}}, {days:{"2026-11-10":{}}}].forEach(u => {
    assert.equal(Brain.weekScore(u, "2026-11-10").points, 0);
    assert.equal(Brain.lifetimePoints(u, "2026-11-11"), 0);
  });
});
test("unionHabits keeps keys from both; primary wins incl. explicit false", () => {
  const a = {"2026-11-10":{walk:false}}, b = {"2026-11-10":{walk:true, sleep:true}, "2026-11-09":{mind:true}};
  assert.deepEqual(Brain.unionHabits(a,b), {"2026-11-10":{walk:false, sleep:true}, "2026-11-09":{mind:true}});
  assert.deepEqual(Brain.unionHabits(undefined, b), b);
});
test("retagOnRename", () => {
  assert.deepEqual(Brain.retagOnRename({name:"salad"}, "spinach salad"), ["greens"]);
  assert.deepEqual(Brain.retagOnRename({brain:["nuts"], brainManual:true}, "spinach salad"), ["nuts"]);
});
