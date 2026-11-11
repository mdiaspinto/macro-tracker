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
