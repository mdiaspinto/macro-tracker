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
  assert.deepEqual(Object.keys(s).sort(), ["lang", "level", "macros", "profile", "streak", "toNext", "today", "week", "yesterday"]);
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
  assert.deepEqual(s.today, { kcal: 0, protein: 0 });
});

test("summary: weekly averages cover Monday..yesterday; today's partial day is separate", () => {
  const u = fixture();
  u.days[TODAY] = [meal("Toast", { ap: 10, ac: 30, af: 5 }), meal("What if", { eaten: false, ap: 99 })];
  const s = Coach.summary(u, TODAY, u.profile);
  // still Mon 665/50 and Tue 330/20 only; today's 205 kcal / 10 g reported on its own
  assert.deepEqual(s.macros, { avgKcal: 498, kcalTarget: 1650, avgProtein: 35, proteinTarget: 100 });
  assert.deepEqual(s.today, { kcal: 205, protein: 10 });
});

test("summary: on Monday there are no completed days, so averages are null (not 0)", () => {
  const u = fixture();
  u.days["2026-11-09"].push(meal("Lunch", { ap: 30, ac: 10, af: 0 }));
  const s = Coach.summary(u, "2026-11-09", u.profile);
  assert.equal(s.macros.avgKcal, null);
  assert.equal(s.macros.avgProtein, null);
  assert.equal(s.macros.kcalTarget, 1650);
  assert.deepEqual(s.today, { kcal: 825, protein: 80 });
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
    assert.deepEqual(s.today, { kcal: 0, protein: 0 });
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

test("classify: maps Worker responses to ok / unavailable / capped / error", () => {
  const c = Coach.classify;
  assert.equal(c("note", 200, { note: "Nice week", tip: "" }), "ok");
  assert.equal(c("note", 200, { note: "  " }), "error");
  assert.equal(c("chat", 200, { reply: "Sure", remaining: 3 }), "ok");
  assert.equal(c("chat", 200, {}), "error");
  assert.equal(c("note", 400, { error: "no_facts" }), "unavailable");
  assert.equal(c("chat", 401, { error: "unauthorized" }), "error");
  assert.equal(c("chat", 429, { error: "daily_limit" }), "capped");
  assert.equal(c("chat", 429, { error: "rate_limited" }), "error");
  assert.equal(c("note", 502, { error: "upstream" }), "error");
  assert.equal(c("note", 500, null), "error");
});

// Network glue with a stubbed fetch. Order matters: "unavailable" sticks for the module's lifetime.
const stubFetch = fn => { globalThis.fetch = fn; };
const reply = (status, body) => async () => ({ status, json: async () => body });
const initCoach = () => Coach.init({ url: "https://w.test", getToken: async () => "tok" });
initCoach();

test("send: network throw rejects with kind 'error' and keeps the question for retry", async () => {
  const u = fixture();
  stubFetch(async () => { throw new TypeError("offline"); });
  await assert.rejects(Coach.send(u, TODAY, "Hi?"), e => e.kind === "error");
  assert.deepEqual(Coach.chatFor(u, TODAY), [{ role: "user", text: "Hi?" }]);
});

test("send: capped drops the just-sent question", async () => {
  const u = fixture();
  u.coach = { notes: {}, chat: { date: TODAY, messages: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] } };
  stubFetch(reply(429, { error: "daily_limit" }));
  await assert.rejects(Coach.send(u, TODAY, "One more?"), e => e.kind === "capped");
  assert.deepEqual(Coach.chatFor(u, TODAY).map(m => m.text), ["a", "b"]);
  assert.equal(Coach.isCapped(u, TODAY), true);
});

// ---- coach memory ----
test("summary: memory passes through when non-empty; memoryDeclined is never sent", () => {
  const u = fixture();
  const s = Coach.summary(u, TODAY, { ...u.profile, memory: ["Struggles to sleep"], memoryDeclined: ["Likes tea"] });
  assert.deepEqual(s.profile.memory, ["Struggles to sleep"]);
  assert.ok(!("memoryDeclined" in s.profile));
  const e = Coach.summary(u, TODAY, { ...u.profile, memory: [], memoryDeclined: [] });
  assert.ok(!("memory" in e.profile) && !("memoryDeclined" in e.profile));
  const m = Coach.summary(u, TODAY, { ...u.profile, memory: "junk" });
  assert.ok(!("memory" in m.profile));
});

test("normFact: case, accents, spacing and trailing punctuation are ignored", () => {
  assert.equal(Coach.normFact("  Le  CUESTA dormir. "), Coach.normFact("le cuesta dormir"));
  assert.equal(Coach.normFact("Duerme mal!!"), "duerme mal");
  assert.equal(Coach.normFact("Está EMBARAZADA…"), Coach.normFact("esta embarazada"));
  assert.equal(Coach.normFact(null), "");
  assert.equal(Coach.normFact("¿Duerme mal?"), "duerme mal");
  assert.equal(Coach.normFact(" ¡\"Le cuesta dormir\"! "), "le cuesta dormir");
});

test("saveFact: reports added / duplicate / full / empty and drops the fact from declined", () => {
  let r = Coach.saveFact({ memory: ["A"], memoryDeclined: ["Likes tea", "B"] }, "  likes TEA. ");
  assert.equal(r.status, "added");
  assert.deepEqual(r.memory, ["A", "likes TEA."]);
  assert.deepEqual(r.memoryDeclined, ["B"]);
  r = Coach.saveFact({ memory: ["Struggles to sleep"] }, "struggles to sleep!");
  assert.equal(r.status, "duplicate");
  assert.deepEqual(r.memory, ["Struggles to sleep"]);
  r = Coach.saveFact({ memory: Array.from({ length: 15 }, (_, i) => "F" + i) }, "New");
  assert.equal(r.status, "full");
  assert.equal(r.memory.length, 15);
  assert.equal(Coach.saveFact({}, "   ").status, "empty");
});

test("forgetFact: removes from memory (by text) and adds it to declined, never in both", () => {
  const p = { memory: ["A", "Has hot flushes"], memoryDeclined: ["Z"] };
  const r = Coach.forgetFact(p, "has hot flushes.");
  assert.deepEqual(r.memory, ["A"]);
  assert.deepEqual(r.memoryDeclined, ["Z", "Has hot flushes"]);
  assert.deepEqual(p.memory, ["A", "Has hot flushes"], "input not mutated");
  assert.deepEqual(Coach.forgetFact({ memory: ["A"] }, "missing").memory, ["A"]);
});

test("memoryOf: the filtered list the UI shows; tolerates junk", () => {
  assert.deepEqual(Coach.memoryOf({ memory: ["A", "", 3, " B "] }), ["A", " B "]);
  assert.deepEqual(Coach.memoryOf(null), []);
});

test("draft helpers: a card's draft is kept only for the same user, day, message and fact", () => {
  const k = Coach.draftKey({ id: "u1" }, TODAY, 3, "Has hot flushes");
  assert.equal(Coach.keepDraft(k, Coach.draftKey({ id: "u1" }, TODAY, 3, "has hot flushes.")), true);
  assert.equal(Coach.keepDraft(k, Coach.draftKey({ id: "u1" }, TODAY, 5, "Allergic to nuts")), false);
  assert.equal(Coach.keepDraft(k, Coach.draftKey({ id: "u1" }, TODAY, 3, "Allergic to nuts")), false);
  assert.equal(Coach.keepDraft(k, Coach.draftKey({ id: "u2" }, TODAY, 3, "Has hot flushes")), false);
  assert.equal(Coach.keepDraft(k, Coach.draftKey({ id: "u1" }, "2026-11-12", 3, "Has hot flushes")), false);
  assert.equal(Coach.keepDraft(null, k), false);
  assert.equal(Coach.keepDraft(undefined, undefined), false);
});

test("canRemember: an empty or blank draft can never be saved", () => {
  assert.equal(Coach.canRemember("Takes iron"), true);
  for (const v of ["", "   ", null, undefined, "\n"]) assert.equal(Coach.canRemember(v), false);
});

test("canSuggest: false for empty, duplicate, declined, or a full list", () => {
  const p = { memory: ["Struggles to sleep"], memoryDeclined: ["Likes tea"] };
  assert.equal(Coach.canSuggest(p, "Has hot flushes"), true);
  assert.equal(Coach.canSuggest(p, "   "), false);
  assert.equal(Coach.canSuggest(p, undefined), false);
  assert.equal(Coach.canSuggest(p, "struggles to SLEEP."), false);
  assert.equal(Coach.canSuggest(p, "Likes tea"), false);
  assert.equal(Coach.canSuggest({}, "Anything"), true);
  assert.equal(Coach.canSuggest(null, "Anything"), true);
  const full = { memory: Array.from({ length: 15 }, (_, i) => "Fact " + i) };
  assert.equal(Coach.canSuggest(full, "One more"), false);
});

test("addMemory: dedups, trims to 80, caps at 15, doesn't mutate", () => {
  const p = { memory: ["A"] };
  const r = Coach.addMemory(p, "  B  ");
  assert.deepEqual(r, ["A", "B"]);
  assert.deepEqual(p.memory, ["A"]);
  assert.deepEqual(Coach.addMemory({ memory: ["Struggles to sleep"] }, "struggles to sleep."), ["Struggles to sleep"]);
  assert.deepEqual(Coach.addMemory({}, "   "), []);
  assert.equal(Coach.addMemory({}, "x".repeat(200))[0].length, 80);
  let m = [];
  for (let i = 0; i < 20; i++) m = Coach.addMemory({ memory: m }, "Fact " + i);
  assert.equal(m.length, 15);
  assert.equal(m[14], "Fact 14");
});

test("removeMemory: by index or by text", () => {
  const p = { memory: ["A", "B", "C"] };
  assert.deepEqual(Coach.removeMemory(p, 1), ["A", "C"]);
  assert.deepEqual(Coach.removeMemory(p, "c"), ["A", "B"]);
  assert.deepEqual(Coach.removeMemory(p, 9), ["A", "B", "C"]);
  assert.deepEqual(Coach.removeMemory({}, 0), []);
  assert.deepEqual(p.memory, ["A", "B", "C"]);
});

test("declineMemory: dedups and keeps the newest 30", () => {
  assert.deepEqual(Coach.declineMemory({ memoryDeclined: ["A"] }, "a."), ["A"]);
  assert.deepEqual(Coach.declineMemory({}, "  "), []);
  let d = [];
  for (let i = 0; i < 35; i++) d = Coach.declineMemory({ memoryDeclined: d }, "Fact " + i);
  assert.equal(d.length, 30);
  assert.equal(d[0], "Fact 5");
  assert.equal(d[29], "Fact 34");
});

test("pendingRemember: index of the latest unanswered suggestion only", () => {
  const ms = [
    { role: "assistant", text: "a", remember: "One" },
    { role: "user", text: "q" },
    { role: "assistant", text: "b", remember: "Two" },
  ];
  assert.equal(Coach.pendingRemember(ms), 2);
  assert.equal(Coach.pendingRemember(ms.slice(0, 3)), 2);
  // answering the latest must not revive an older unanswered one
  assert.equal(Coach.pendingRemember([{ role: "assistant", remember: "Old" }, { role: "assistant", remember: "New", rememberState: "declined" }]), -1);
  assert.equal(Coach.pendingRemember([{ role: "assistant", text: "x" }]), -1);
  assert.equal(Coach.pendingRemember(undefined), -1);
});

test("send: stores remember on the assistant message only when canSuggest at receive time", async () => {
  const u = fixture();
  u.id = "mem1";
  u.profile.memory = ["Struggles to sleep"];
  stubFetch(reply(200, { reply: "Hi", remaining: 5, remember: "  Has hot flushes " }));
  await Coach.send(u, TODAY, "I get hot flushes");
  assert.deepEqual(Coach.chatFor(u, TODAY)[1], { role: "assistant", text: "Hi", remember: "Has hot flushes" });
  stubFetch(reply(200, { reply: "Hi2", remaining: 4, remember: "struggles to sleep." }));
  await Coach.send(u, TODAY, "sleep again");
  assert.deepEqual(Coach.chatFor(u, TODAY)[3], { role: "assistant", text: "Hi2" });
  stubFetch(reply(200, { reply: "Hi3", remaining: 3 }));
  await Coach.send(u, TODAY, "ok");
  assert.deepEqual(Coach.chatFor(u, TODAY)[5], { role: "assistant", text: "Hi3" });
});

test("send: the request carries memory inside summary.profile", async () => {
  const u = fixture();
  u.id = "mem2";
  u.profile.memory = ["Allergic to nuts"];
  let sent;
  stubFetch(async (url, o) => { sent = JSON.parse(o.body); return { status: 200, json: async () => ({ reply: "r", remaining: 1 }) }; });
  await Coach.send(u, TODAY, "hello");
  assert.deepEqual(sent.summary.profile.memory, ["Allergic to nuts"]);
});

// "unavailable" sticks until the next init(), so this test re-inits when done and can sit anywhere.
test("send: unavailable (old Worker) drops the just-sent question", async () => {
  initCoach();
  const u = fixture();
  u.id = "other";
  stubFetch(reply(400, { error: "no_facts" }));
  await assert.rejects(Coach.send(u, TODAY, "Hello?"), e => e.kind === "unavailable");
  assert.deepEqual(Coach.chatFor(u, TODAY), []);
  assert.equal(Coach.available(), false);
  initCoach();
  assert.equal(Coach.available(), true);
});
