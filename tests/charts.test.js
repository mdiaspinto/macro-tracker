const test = require("node:test"); const assert = require("node:assert/strict");
const Charts = require("../charts.js");
const pt = (date, value) => ({ date, value });
const find = (pts, d) => pts.find(p => p.date === d);

test("rangeStart: day offsets and all", () => {
  assert.equal(Charts.rangeStart("2026-11-13", "7"), "2026-11-07");
  assert.equal(Charts.rangeStart("2026-11-13", "30"), "2026-10-15");
  assert.equal(Charts.rangeStart("2026-03-01", "7"), "2026-02-23");
  assert.equal(Charts.rangeStart("2026-11-13", "all"), null);
});
test("filterRange: inclusive bounds", () => {
  const pts = ["2026-11-06", "2026-11-07", "2026-11-13", "2026-11-14"].map(d => pt(d, 1));
  assert.deepEqual(Charts.filterRange(pts, "7", "2026-11-13").map(p => p.date), ["2026-11-07", "2026-11-13"]);
});
test("rollingMean: mean over trailing 7 calendar days", () => {
  const out = Charts.rollingMean([pt("2026-11-01", 1000), pt("2026-11-02", 2000), pt("2026-11-03", 3000), pt("2026-11-12", 4000)]);
  assert.equal(find(out, "2026-11-03").value, 2000);
  assert.equal(find(out, "2026-11-01"), undefined);
  assert.equal(find(out, "2026-11-02"), undefined);
  assert.equal(find(out, "2026-11-07").value, 2000);
  assert.equal(find(out, "2026-11-08"), undefined);
  assert.equal(find(out, "2026-11-12"), undefined);
});
test("rollingMean: skips windows with fewer than 3 logged days", () => {
  assert.deepEqual(Charts.rollingMean([pt("2026-11-01", 1000), pt("2026-11-05", 2000)]), []);
});
test("dateTicks: Mondays for long spans", () => {
  assert.deepEqual(Charts.dateTicks("2026-09-19", "2026-11-13", 5), ["2026-09-21", "2026-10-05", "2026-10-19", "2026-11-02"]);
});
test("dateTicks: days for short spans", () => {
  assert.deepEqual(Charts.dateTicks("2026-11-07", "2026-11-13", 5), ["2026-11-07", "2026-11-09", "2026-11-11", "2026-11-13"]);
});
test("dateTicks: single day", () => {
  assert.deepEqual(Charts.dateTicks("2026-11-13", "2026-11-13"), ["2026-11-13"]);
});
test("onTarget: +/-10% inclusive", () => {
  assert.deepEqual(Charts.onTarget([2160, 2400, 2640, 2641].map(v => pt("2026-11-01", v)), 2400), { hit: 3, total: 4 });
  assert.deepEqual(Charts.onTarget([], 2400), { hit: 0, total: 0 });
});
