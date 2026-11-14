const test = require("node:test"); const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const Cast = require("../brain/cast.js");
test("members in order with names", () => {
  assert.deepEqual(Cast.MEMBERS.map(m => [m.id, m.name]), [["coco","Coco"],["teo","Teo"],["rosa","Rosa"],["luna","Luna"]]);
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
