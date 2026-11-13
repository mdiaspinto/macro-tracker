const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path");
const Icons = require("../icons.js"); const Brain = require("../brain.js"); const Game = require("../game.js");
const EMOJI = /[\p{Emoji_Presentation}️]/u;

test("NAMES covers every icon the data uses", () => {
  const used = [].concat(Brain.CATEGORIES.map(c => c.icon), Brain.LEVELS.map(l => l.icon), Game.BADGES.map(b => b.icon), ["message-circle", "lightbulb", "x"]);
  used.forEach(n => assert.ok(Icons.NAMES.includes(n), "missing icon: " + n));
});
test("svg returns a use reference", () => {
  assert.ok(Icons.svg("fish").includes('href="#i-fish"'));
  assert.ok(Icons.svg("fish").includes('aria-hidden="true"'));
  assert.ok(Icons.svg("fish", "big").includes('class="ic big"'));
});
test("svg of an unknown name is empty", () => { assert.equal(Icons.svg("nope"), ""); });
test("sprite has one symbol per name and no script", () => {
  const s = Icons.sprite();
  Icons.NAMES.forEach(n => assert.ok(s.includes('<symbol id="i-' + n + '"'), n));
  assert.ok(!s.includes("<script"));
});
test("data has no emoji", () => {
  ["brain.js", "game.js"].forEach(f => assert.ok(!EMOJI.test(fs.readFileSync(path.join(__dirname, "..", f), "utf8")), f));
});
test("new icons exist", () => {
  ["gift", "lock", "award", "scale", "zap", "party-popper", "globe", "points"].forEach(n => assert.ok(Icons.NAMES.includes(n), n));
});
