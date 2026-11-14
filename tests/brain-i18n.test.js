const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path");
const EMOJI = /[\p{Emoji_Presentation}️]/u;
const html = fs.readFileSync(path.join(__dirname, "..", "brain", "index.html"), "utf8");
const start = html.indexOf("const T = {");
const block = html.slice(start + "const T = ".length, html.indexOf("\n};", start) + 2);
const T = new Function("return " + block)();
const each = (f) => ["en", "es"].forEach((l) => Object.keys(T[l]).forEach((k) => f(l, k, T[l][k])));

test("no emoji in any string", () => {
  each((l, k, v) => assert.ok(!EMOJI.test(v), l + "." + k + " has emoji"));
});
test("en and es have the same keys", () => {
  assert.deepEqual(Object.keys(T.es).sort(), Object.keys(T.en).sort());
});
test("brief copy is exact", () => {
  const want = {
    title: ["Brain games", "Juegos mentales"],
    tagline: ["Short daily games linked to a sharper mind", "Juegos cortos para cada día, ligados a una mente más ágil"],
    play: ["Play today's games", "Jugar hoy"],
    ring: ["{n} of 3 this week", "{n} de 3 esta semana"],
    back: ["Back to tracker", "Volver al tracker"],
    peekQ1: ["Who peeked out?", "¿Quién se asomó?"],
    peekQ2: ["Where was the {thing}?", "¿Dónde apareció {thing}?"],
    thing_balloon: ["balloon", "el globo"],
    thing_star: ["star", "la estrella"],
    thing_gift: ["gift", "el regalo"],
    paradeQ: ["Tap them in the same order", "Tócalos en el mismo orden"],
    paradeQRev: ["Tap them in reverse order", "Tócalos al revés"],
    done: ["Done for today. See you next time!", "¡Listo por hoy! ¡Hasta la próxima!"],
  };
  Object.keys(want).forEach((k) => {
    assert.equal(T.en[k], want[k][0], "en." + k);
    assert.equal(T.es[k], want[k][1], "es." + k);
  });
});
test("no medical claims", () => {
  each((l, k, v) => assert.ok(!/alzheimer|prevent|prevenir|cura/i.test(v), l + "." + k + ": " + v));
});
