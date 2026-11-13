const test = require("node:test"); const assert = require("node:assert/strict");
const Tour = require("../tour.js");
const vp = { w: 375, h: 812 }, size = { w: 343, h: 180 };

test("place: no target -> centred card inside the gutters", () => {
  assert.deepEqual(Tour.place(null, size, vp), { top: 316, left: 16, side: "center" });
  assert.deepEqual(Tour.place(null, { w: 360, h: 200 }, { w: 1280, h: 800 }), { top: 300, left: 460, side: "center" });
});
test("place: below the target when there is room, centred on it", () => {
  const p = Tour.place({ top: 100, left: 600, width: 200, height: 80 }, { w: 360, h: 200 }, { w: 1280, h: 800 });
  assert.deepEqual(p, { top: 100 + 80 + Tour.GAP, left: 520, side: "below" });
});
test("place: above the target when there is no room below", () => {
  const p = Tour.place({ top: 600, left: 8, width: 359, height: 120 }, size, vp);
  assert.equal(p.side, "above"); assert.equal(p.top, 600 - Tour.GAP - 180);
});
test("place: clamped horizontally to 16px gutters", () => {
  assert.equal(Tour.place({ top: 10, left: 0, width: 40, height: 40 }, { w: 300, h: 100 }, { w: 1000, h: 800 }).left, 16);
  assert.equal(Tour.place({ top: 10, left: 960, width: 40, height: 40 }, { w: 300, h: 100 }, { w: 1000, h: 800 }).left, 1000 - 16 - 300);
});
test("place: a target too tall for either side pins the bubble to the roomier edge", () => {
  const low = Tour.place({ top: 20, left: 8, width: 359, height: 700 }, size, vp);
  assert.deepEqual(low, { top: 812 - 16 - 180, left: 16, side: "over" });
  const high = Tour.place({ top: 150, left: 8, width: 359, height: 640 }, size, vp);
  assert.deepEqual(high, { top: 16, left: 16, side: "over" });
});
test("place: a target scrolled off-screen still keeps the bubble in view", () => {
  const p = Tour.place({ top: -300, left: 8, width: 359, height: 100 }, size, vp);
  assert.equal(p.side, "below"); assert.equal(p.top, 16);
});
test("tour.js loads in node without a DOM and is idle", () => {
  assert.equal(Tour.active(), false);
  assert.equal(typeof Tour.start, "function");
});
test("place: a tall target with room beside it gets the bubble to its right, else its left, level with its middle", () => {
  const wide = { w: 1280, h: 800 }, s = { w: 360, h: 190 };
  assert.deepEqual(Tour.place({ top: 183, left: 106, width: 340, height: 423 }, s, wide), { top: 183 + 423 / 2 - 95, left: 106 + 340 + Tour.GAP, side: "right" });
  const p = Tour.place({ top: 183, left: 900, width: 340, height: 423 }, s, wide);
  assert.equal(p.side, "left"); assert.equal(p.left, 900 - Tour.GAP - 360);
});

test("actionsHtml: a middle step has Skip, Back and Next", () => {
  const h = Tour.actionsHtml({}, 1, 3, {skip:"S", back:"B", next:"N"});
  assert.match(h, /data-tour="skip"/); assert.match(h, /data-tour="back"/); assert.match(h, /data-tour="next"[^>]*>N</);
});
test("actionsHtml: a wait step has Skip and Back but no Next", () => {
  const h = Tour.actionsHtml({wait:true}, 1, 3, {});
  assert.match(h, /data-tour="skip"/); assert.doesNotMatch(h, /data-tour="next"/);
});
test("actionsHtml: the last step with actions shows them, primary first gets tour-next, no Skip, no Done", () => {
  const h = Tour.actionsHtml({actions:[{id:"create", label:"Create <me>", primary:true}, {id:"keep", label:"Keep"}]}, 2, 3, {done:"Done"});
  assert.match(h, /data-tour="act" data-id="create"/); assert.match(h, /Create &lt;me&gt;/);
  assert.match(h, /<button[^>]*class="[^"]*tour-next[^"]*"[^>]*data-tour="act" data-id="create"/);
  assert.doesNotMatch(h, /<button[^>]*tour-next[^>]*data-id="keep"/);
  assert.doesNotMatch(h, /data-tour="skip"/); assert.doesNotMatch(h, />Done</);
});
test("actionsHtml: the first step has no Back", () => {
  assert.doesNotMatch(Tour.actionsHtml({}, 0, 3, {}), /data-tour="back"/);
});
test("actionsHtml: a plain step keeps today's buttons (Done on the last, no Skip)", () => {
  const h = Tour.actionsHtml({}, 2, 3, {done:"Done"});
  assert.match(h, /data-tour="next"[^>]*>Done</); assert.doesNotMatch(h, /data-tour="skip"/);
});
test("holePath: viewport with a hole at the rect", () => {
  assert.equal(Tour.holePath({top:10, left:20, width:30, height:40}, {w:100, h:200}),
    'path(evenodd, "M0 0H100V200H0Z M20 10H50V50H20Z")');
});
test("suspend and signal are safe with no tour running", () => {
  assert.equal(Tour.suspend(), false); assert.equal(Tour.signal(), false); assert.equal(Tour.suspended(), false);
});
