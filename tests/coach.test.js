const test = require("node:test"); const assert = require("node:assert/strict");
const Coach = require("../coach.js");
const Brain = require("../brain.js");
const meal = (name, o = {}) => ({ id: name, name, eaten: true, ap: 0, ac: 0, af: 0, brain: [], ...o });
const TODAY = "2026-11-11"; // Wednesday; week starts Mon 2026-11-09

function fixture() {
  return {
    lang: "es", goal: "lean",
    targets: { lean: { p: 100, c: 200, f: 50 }, bulk: { p: 1, c: 1, f: 1 } },
    days: {
      "2026-11-08": [meal("Steak", { ap: 50, ac: 0, af: 20, brain: ["redMeat"] })],
      "2026-11-09": [meal("Salmon salad", { ap: 40, ac: 10, af: 20, brain: ["fish", "oilyFish", "greens"] }),
                     meal("Oats", { ap: 10, ac: 50, af: 5, brain: ["grains"] })],
      "2026-11-10": [meal("Lentil soup", { ap: 20, ac: 40, af: 10, brain: ["beans"] }),
                     meal("Cake", { eaten: false, ap: 5, ac: 50, af: 20 })],
    },
    habits: { "2026-11-09": { walk: true, social: true }, "2026-11-10": { social: true }, "2026-11-11": { social: true } },
    profile: { age: 60, sex: "female", heightCm: 160, activity: "light", goals: ["brainHealth"], likes: "fish", avoids: "",
               familyHistory: false, tone: "cheer", notes: "" },
  };
}

test("summary: shape and values for a fixture user", () => {
  const u = fixture(), s = Coach.summary(u, TODAY, u.profile);
  assert.deepEqual(Object.keys(s).sort(), ["lang", "level", "macros", "profile", "streak", "toNext", "week", "yesterday"]);
  assert.equal(s.lang, "es");
  assert.equal(s.week.bar, Math.round(Brain.weekScore(u, TODAY).bar * 100) / 100);
  assert.equal(s.week.missing.length, 12);
  assert.ok(!s.week.missing.some(m => m.id === "social"));
  assert.deepEqual(s.week.missing.find(m => m.id === "fish"), { id: "fish", remaining: 1 });
  assert.deepEqual(s.week.missing.find(m => m.id === "walk"), { id: "walk", remaining: 4 });
  assert.deepEqual(s.week.missing.find(m => m.id === "greens"), { id: "greens", remaining: 5 });
  assert.equal(s.streak, 3);
  const lv = Brain.levelFor(Brain.lifetimePoints(u, TODAY));
  assert.equal(s.level, lv.level.id);
  assert.equal(s.toNext, lv.toNext);
  // Mon 665 kcal / 50 g, Tue 330 kcal / 20 g (what-if cake and last week's steak excluded)
  assert.deepEqual(s.macros, { avgKcal: 498, kcalTarget: 1650, avgProtein: 35, proteinTarget: 100 });
  assert.deepEqual(s.yesterday, ["Lentil soup"]);
});

test("summary: yesterday capped at 8 and excludes what-if meals", () => {
  const u = fixture();
  u.days["2026-11-10"] = Array.from({ length: 10 }, (_, i) => meal("Meal " + i))
    .concat([meal("What if A", { eaten: false }), meal("What if B", { eaten: false })]);
  const s = Coach.summary(u, TODAY, u.profile);
  assert.equal(s.yesterday.length, 8);
  assert.ok(s.yesterday.every(n => n.startsWith("Meal ")));
});

test("summary: empty notes and false familyHistory are omitted; filled ones kept", () => {
  const u = fixture();
  const s = Coach.summary(u, TODAY, u.profile);
  assert.ok(!("familyHistory" in s.profile));
  assert.ok(!("notes" in s.profile));
  assert.equal(s.profile.age, 60);
  assert.equal(u.profile.notes, "", "input profile not mutated");
  const s2 = Coach.summary(u, TODAY, { ...u.profile, familyHistory: true, notes: "Knee pain" });
  assert.equal(s2.profile.familyHistory, true);
  assert.equal(s2.profile.notes, "Knee pain");
});

test("summary: profile argument defaults to user.profile", () => {
  const u = fixture();
  assert.equal(Coach.summary(u, TODAY).profile.likes, "fish");
});

test("summary: empty user doesn't throw", () => {
  for (const u of [{}, null, { days: { "2026-11-10": "junk" }, habits: null, targets: {} }]) {
    const s = Coach.summary(u, TODAY);
    assert.equal(s.lang, "en");
    assert.deepEqual(s.profile, {});
    assert.equal(s.streak, 0);
    assert.equal(s.level, "sprout");
    assert.deepEqual(s.yesterday, []);
    assert.deepEqual(s.macros, { avgKcal: null, kcalTarget: null, avgProtein: null, proteinTarget: null });
    assert.equal(s.week.missing.length, 13);
  }
});

test("mergeCoach: notes by date with primary winning; chat from the later date, primary on tie", () => {
  const a = { notes: { "2026-11-10": { note: "A10", tip: "" }, "2026-11-11": { note: "A11", tip: "" } },
              chat: { date: "2026-11-10", messages: [{ role: "user", text: "a" }] } };
  const b = { notes: { "2026-11-09": { note: "B9", tip: "" }, "2026-11-11": { note: "B11", tip: "" } },
              chat: { date: "2026-11-11", messages: [{ role: "user", text: "b" }] } };
  const m = Coach.mergeCoach(a, b);
  assert.deepEqual(Object.keys(m.notes).sort(), ["2026-11-09", "2026-11-10", "2026-11-11"]);
  assert.equal(m.notes["2026-11-11"].note, "A11");
  assert.equal(m.chat.date, "2026-11-11");
  assert.equal(Coach.mergeCoach(b, { chat: { date: "2026-11-11", messages: [] } }).chat.messages[0].text, "b");
  assert.equal(Coach.mergeCoach(undefined, b).chat.messages[0].text, "b");
  assert.deepEqual(Coach.mergeCoach(undefined, undefined), { notes: {} });
  // Firebase drops empty arrays: a chat without messages is still a chat
  assert.equal(Coach.mergeCoach({ chat: { date: "2026-11-12" } }, b).chat.date, "2026-11-12");
});
