const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path");
const EMOJI = /[\p{Emoji_Presentation}️]/u;
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("const T = {");
const block = html.slice(start + "const T = ".length, html.indexOf("\n};", start) + 2);
const T = new Function("return " + block)();

test("no emoji in any string", () => {
  ["en", "es"].forEach(l => Object.keys(T[l]).forEach(k => {
    assert.ok(!EMOJI.test(T[l][k]), l + "." + k + " has emoji");
  }));
});
test("es has every en key", () => {
  const es = Object.keys(T.es);
  Object.keys(T.en).forEach(k => assert.ok(es.includes(k), "es missing " + k));
});
test("new copy", () => {
  assert.equal(T.en.brainNext, "{name}: {n} more this week");
  assert.equal(T.es.brainNext, "{name}: {n} más esta semana");
  assert.equal(T.en.bvToNext, "{n} points to {level}");
  assert.equal(T.es.bvToNext, "{n} puntos para {level}");
});
test("new shop copy", () => {
  assert.equal(T.en.shopOpen, "Open a box");
  assert.equal(T.es.shopShort, "Te faltan {n} puntos para la próxima caja");
  assert.equal(T.en.shopNext, "{n} more characters: {name} backdrop");
  assert.equal(T.es.passport, "Pasaporte");
});
test("demo copy", () => {
  assert.equal(T.en.demoTry, "Try the demo"); assert.equal(T.es.demoTry, "Probar la demo");
  assert.equal(T.en.tourDemoWelcomeT, "Hi {name}, welcome to the demo"); assert.equal(T.es.tourDemoWelcomeT, "¡Hola, {name}! Esto es la demo");
  assert.equal(T.en.tourDemoCollectB, "Tap Open your free box to get your first character.");
  assert.equal(T.es.tourDemoCollectB, "Toca Abre tu caja gratis para conseguir tu primer personaje.");
  assert.equal(T.en.tourDemoEndT, "Like it, {name}?"); assert.equal(T.es.tourDemoEndT, "¿Te gusta, {name}?");
  assert.equal(T.en.demoBanner, "Demo · sample data"); assert.equal(T.es.demoBanner, "Demo · datos de ejemplo");
  assert.equal(T.en.demoBackToDemo, "Back to the demo"); assert.equal(T.es.demoBackToDemo, "Volver a la demo");
});
