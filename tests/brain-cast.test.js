const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const Cast = require("../brain/cast.js");
const CAST = [["teo","Teo","blue"],["flor","Flor","pink"],["pepe","Pepe","green"],["nico","Nico","dark"],["beto","Beto","orange"],["gael","Gael","brown"],["dina","Dina","white"],["rey","Rey","yellow"],["hugo","Hugo","green"],["sol","Sol","yellow"],["estela","Estela","blue"],["alma","Alma","red"],["marco","Marco","blue"],["inaki","Iñaki","brown"],["vera","Vera","white"],["oscar","Óscar","gray"],["zoe","Zoe","green"]];
test("members in order with names and groups", () => {
  assert.deepEqual(Cast.MEMBERS.map(m => [m.id, m.name, m.group]), CAST);
  assert.equal(Cast.GROUPS.teo, "blue");
  CAST.forEach(c => assert.equal(Cast.GROUPS[c[0]], c[2]));
});
test("rosa and luna are gone", () => {
  ["rosa","luna"].forEach(id => {
    assert.ok(!Cast.MEMBERS.some(m => m.id === id));
    assert.ok(!fs.existsSync(path.join(__dirname, "..", "brain", "img", id + ".webp")));
  });
});
test("coco is gone as a member but cheer and oops art stay", () => {
  assert.equal(Cast.MEMBERS.length, 17);
  assert.equal(Cast.MEMBERS[0].id, "teo");
  assert.ok(!Cast.MEMBERS.some(m => m.id === "coco"));
  assert.ok(!fs.existsSync(path.join(__dirname, "..", "brain", "img", "coco.webp")));
  ["cheer", "oops"].forEach(k => assert.ok(fs.existsSync(path.join(__dirname, "..", "brain", "img", k + ".webp"))));
  assert.deepEqual(Cast.ART, { logo: "img/logo.webp", bg: "img/bg.webp", cheer: "img/cheer.webp", oops: "img/oops.webp" });
});
test("3 targets and 3 distractors", () => {
  assert.deepEqual(Cast.TARGETS.map(x => x.id), ["balloon","star","gift"]);
  assert.deepEqual(Cast.DISTRACTORS.map(x => x.id), ["cloud","leaf","butterfly"]);
});
test("ids are unique across all lists", () => {
  const ids = [...Cast.MEMBERS, ...Cast.TARGETS, ...Cast.DISTRACTORS].map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
});
test("every img path exists", () => {
  const imgs = [...Cast.MEMBERS, ...Cast.TARGETS, ...Cast.DISTRACTORS].map(x => x.img).concat(Object.values(Cast.ART));
  assert.deepEqual(Object.keys(Cast.ART), ["logo","bg","cheer","oops"]);
  imgs.forEach(i => assert.ok(fs.existsSync(path.join(__dirname, "..", "brain", i)), i));
});
