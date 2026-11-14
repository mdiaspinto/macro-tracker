const test = require("node:test");
const assert = require("node:assert");
const Sync = require("../brain/sync.js");

const FB = { apiKey: "KEY", databaseURL: "https://db.example.com", emailDomain: "dom.example.com" };
const NOW = 1000000;
const reply = (body, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => body });

// Recording fetch: routes by URL; `routes` maps a substring to a reply or function.
function rig(routes, session, extra) {
  const calls = [];
  const store = new Map();
  if (session) store.set("brainGames.session", JSON.stringify(session));
  Object.keys(extra || {}).forEach((k) => store.set(k, JSON.stringify(extra[k])));
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const fetch = async (url, opts) => {
    const o = opts || {};
    calls.push({ url, method: o.method || "GET", body: o.body });
    const hit = Object.keys(routes).find((k) => url.indexOf(k) >= 0);
    if (!hit) return reply(null);
    const r = routes[hit];
    return typeof r === "function" ? r(url, o) : r;
  };
  const api = Sync.create({ fetch, storage, now: () => NOW, firebase: FB });
  return { api, calls, store, storage };
}
const live = { username: "ana", uid: "U1", idToken: "tok", refreshToken: "ref", expiresAt: NOW + 3600000 };
const dbPath = (c) => c.url.slice(FB.databaseURL.length).split(".json")[0];
const day = (peek, at) => ({ modes: { peek, parade: 0, names: 0 }, minutes: 0, completedAt: at, _ms: { peek: peek * 1000, parade: 0, names: 0 } });

test("trackerSession reads but never writes macroTracker.session", () => {
  const { api, store, calls } = rig({});
  store.set("macroTracker.session", JSON.stringify(live));
  const writes = [];
  const orig = store.set.bind(store);
  store.set = (k, v) => { writes.push(k); return orig(k, v); };
  assert.strictEqual(api.trackerSession().uid, "U1");
  api.useTrackerSession();
  api.signOut();
  assert.ok(!writes.includes("macroTracker.session"));
  assert.ok(store.has("macroTracker.session"));
  assert.strictEqual(calls.length, 0);
});

test("useTrackerSession copies to brainGames.session; null without a tracker session", () => {
  const { api, store } = rig({});
  assert.strictEqual(api.useTrackerSession(), null);
  assert.strictEqual(store.has("brainGames.session"), false);
  store.set("macroTracker.session", JSON.stringify(live));
  assert.deepStrictEqual(api.useTrackerSession(), live);
  assert.deepStrictEqual(JSON.parse(store.get("brainGames.session")), live);
  assert.deepStrictEqual(api.session(), live);
});

test("signOut keeps macroTracker.session and removes only brain keys", () => {
  const { api, store } = rig({}, live, { "brainGames.profile": "ana", "brainGames.guest": { days: {} }, "brainGames.lang": "es" });
  store.set("macroTracker.session", JSON.stringify(live));
  api.signOut();
  assert.ok(store.has("macroTracker.session"));
  assert.ok(!store.has("brainGames.session") && !store.has("brainGames.profile"));
  assert.ok(store.has("brainGames.guest") && store.has("brainGames.lang"));
  assert.strictEqual(api.session(), null);
});

test("signIn posts the synthetic email and stores the session", async () => {
  const { api, calls, store } = rig({ "accounts:signInWithPassword": reply({ localId: "U9", idToken: "t", refreshToken: "r", expiresIn: "3600" }) });
  const s = await api.signIn(" Ana_1 ", "pw1234");
  assert.deepStrictEqual(s, { username: "Ana_1", uid: "U9", idToken: "t", refreshToken: "r", expiresAt: NOW + 3600000 });
  assert.match(calls[0].url, /identitytoolkit\.googleapis\.com\/v1\/accounts:signInWithPassword\?key=KEY$/);
  assert.strictEqual(JSON.parse(calls[0].body).email, "ana_1@dom.example.com");
  assert.deepStrictEqual(JSON.parse(store.get("brainGames.session")), s);
});

test("signUp uses accounts:signUp; auth errors carry the Firebase message", async () => {
  const ok = rig({ "accounts:signUp": reply({ localId: "U2", idToken: "t", refreshToken: "r", expiresIn: 60 }) });
  assert.strictEqual((await ok.api.signUp("bo", "pw1234")).uid, "U2");
  const bad = rig({ "accounts:signUp": reply({ error: { message: "EMAIL_EXISTS" } }, 400) });
  await assert.rejects(() => bad.api.signUp("bo", "pw1234"), /EMAIL_EXISTS/);
  assert.strictEqual(bad.store.has("brainGames.session"), false);
});

test("rejects invalid username before any fetch", async () => {
  const { api, calls } = rig({});
  for (const u of ["a", "has space", "x".repeat(21), "bad-name", ""]) {
    await assert.rejects(() => api.signIn(u, "pw"), /invalid-username/);
    await assert.rejects(() => api.signUp(u, "pw"), /invalid-username/);
  }
  assert.strictEqual(calls.length, 0);
});

test("profiles lists tracker profiles from state.users", async () => {
  const { api, calls } = rig({ "/users/U1.json": reply({ username: "ana", state: { users: [{ name: " Ana ", lang: "es" }, { name: "Luis" }] } }) }, live);
  assert.deepStrictEqual(await api.profiles(), [{ key: "ana", name: " Ana ", lang: "es" }, { key: "luis", name: "Luis", lang: null }]);
  assert.strictEqual(calls[0].method, "GET");
  assert.match(calls[0].url, /\?auth=tok$/);
});

test("profiles falls back to username for empty account", async () => {
  for (const body of [null, { username: "Ana" }, { state: { users: [] } }]) {
    const { api } = rig({ "/users/U1.json": reply(body) }, live);
    assert.deepStrictEqual(await api.profiles(), [{ key: "ana", name: "ana", lang: null }]);
  }
});

test("load returns defaults for missing data and the stored data otherwise", async () => {
  const none = rig({ "/brain/U1/ana.json": reply(null) }, live);
  assert.deepStrictEqual(await none.api.load("ana"), { sessions: {}, progress: null });
  const some = rig({ "/brain/U1/ana.json": reply({ sessions: { "2026-11-14": day(5) } }) }, live);
  assert.deepStrictEqual(await some.api.load("ana"), { sessions: { "2026-11-14": day(5) }, progress: null });
});

test("writes only PATCH under /brain/<uid>/<key>", async () => {
  const guest = { days: { "2026-11-13": day(30, null), "2026-11-14": day(700, 5) }, progress: { stars: 2 } };
  const remote = { sessions: { "2026-11-14": day(100, 9) } };
  const { api, calls } = rig({ "/brain/U1/ana.json": reply(remote) }, live, { "brainGames.guest": guest });
  await api.saveDay("ana", "2026-11-12", day(1, null));
  await api.saveProgress("ana", { stars: 1 });
  await api.uploadGuest("ana");
  const writes = calls.filter((c) => c.method !== "GET");
  assert.ok(writes.length >= 4);
  writes.forEach((c) => {
    assert.strictEqual(c.method, "PATCH");
    assert.ok(dbPath(c).startsWith("/brain/U1/ana/"), dbPath(c));
  });
  assert.ok(calls.every((c) => !/\/users\/|\/brain\/U1\.json/.test(c.url) || c.method === "GET"));
  assert.deepStrictEqual(writes.map(dbPath).slice(0, 2), ["/brain/U1/ana/sessions/2026-11-12", "/brain/U1/ana/progress"]);
});

test("refreshes an expired token before a write", async () => {
  const old = Object.assign({}, live, { expiresAt: NOW + 30000 });
  const { api, calls, store } = rig({
    "securetoken.googleapis.com": reply({ id_token: "new", refresh_token: "ref2", expires_in: "3600" }),
    "/brain/": reply({}),
  }, old);
  await api.saveProgress("ana", { stars: 1 });
  assert.match(calls[0].url, /securetoken\.googleapis\.com\/v1\/token\?key=KEY$/);
  assert.strictEqual(calls[0].method, "POST");
  assert.strictEqual(calls[0].body, "grant_type=refresh_token&refresh_token=ref");
  assert.match(calls[1].url, /\?auth=new$/);
  const s = JSON.parse(store.get("brainGames.session"));
  assert.deepStrictEqual([s.idToken, s.refreshToken, s.expiresAt, s.uid], ["new", "ref2", NOW + 3600000, "U1"]);
});

test("a valid token is not refreshed", async () => {
  const { api, calls } = rig({ "/brain/": reply({}) }, live);
  await api.saveProgress("ana", {});
  assert.strictEqual(calls.length, 1);
});

test("refresh 400 clears only brain session and profile, then signed-out", async () => {
  const old = Object.assign({}, live, { expiresAt: NOW });
  const { api, store } = rig({ "securetoken": reply({}, 400) }, old, { "brainGames.profile": "ana", "brainGames.guest": {}, "brainGames.lang": "es" });
  store.set("macroTracker.session", JSON.stringify(live));
  await assert.rejects(() => api.saveProgress("ana", {}), /signed-out/);
  assert.ok(!store.has("brainGames.session") && !store.has("brainGames.profile"));
  assert.ok(store.has("macroTracker.session") && store.has("brainGames.guest") && store.has("brainGames.lang"));
});

test("other refresh failures throw net and keep the session", async () => {
  const old = Object.assign({}, live, { expiresAt: NOW });
  const a = rig({ "securetoken": reply({}, 500) }, old);
  await assert.rejects(() => a.api.saveProgress("ana", {}), /^Error: net$/);
  assert.ok(a.store.has("brainGames.session"));
  const b = rig({ "securetoken": () => { throw new TypeError("offline"); } }, old);
  await assert.rejects(() => b.api.saveProgress("ana", {}), /^Error: net$/);
});

test("no session throws signed-out without fetching", async () => {
  const { api, calls } = rig({});
  await assert.rejects(() => api.load("ana"), /signed-out/);
  assert.strictEqual(calls.length, 0);
});

test("concurrent calls share one in-flight refresh", async () => {
  const old = Object.assign({}, live, { expiresAt: NOW });
  const { api, calls } = rig({
    "securetoken": async () => { await new Promise((r) => setTimeout(r, 5)); return reply({ id_token: "n", refresh_token: "r2", expires_in: 3600 }); },
    "/brain/": reply({}),
  }, old);
  await Promise.all([api.saveProgress("ana", {}), api.saveProgress("ana", {}), api.saveDay("ana", "2026-11-14", day(1))]);
  assert.strictEqual(calls.filter((c) => c.url.indexOf("securetoken") >= 0).length, 1);
  assert.strictEqual(calls.filter((c) => c.method === "PATCH").length, 3);
});

test("uploadGuest merges with remote and clears guest", async () => {
  const guest = { days: { "2026-11-14": day(700, 5), "2026-11-13": day(30, null) }, progress: { stars: 2 } };
  const remote = { sessions: { "2026-11-14": day(100, 9) } };
  const { api, calls, store } = rig({ "/brain/U1/ana.json": reply(remote) }, live, { "brainGames.guest": guest });
  await api.uploadGuest("ana");
  const body = (d) => JSON.parse(calls.find((c) => dbPath(c) === "/brain/U1/ana/sessions/" + d).body);
  assert.deepStrictEqual([body("2026-11-14").modes.peek, body("2026-11-14").completedAt], [700, 5]);
  assert.deepStrictEqual(body("2026-11-13"), guest.days["2026-11-13"]);
  assert.deepStrictEqual(JSON.parse(calls.find((c) => dbPath(c) === "/brain/U1/ana/progress").body), { stars: 2 });
  assert.strictEqual(store.has("brainGames.guest"), false);
});

test("uploadGuest keeps remote progress and saves a missing remote day as is", async () => {
  const guest = { days: { "2026-11-14": day(40, null) }, progress: { stars: 9 } };
  const { api, calls } = rig({ "/brain/U1/ana.json": reply({ progress: { stars: 1 }, sessions: {} }) }, live, { "brainGames.guest": guest });
  await api.uploadGuest("ana");
  assert.strictEqual(calls.some((c) => /progress$/.test(dbPath(c)) && c.method === "PATCH"), false);
  assert.deepStrictEqual(JSON.parse(calls.find((c) => c.method === "PATCH").body), guest.days["2026-11-14"]);
});

test("uploadGuest keeps the guest data if a write fails", async () => {
  const guest = { days: { "2026-11-14": day(40, null) } };
  const { api, store } = rig({ "/brain/U1/ana": (u, o) => (o.method === "PATCH" ? reply({}, 500) : reply(null)) }, live, { "brainGames.guest": guest });
  await assert.rejects(() => api.uploadGuest("ana"), /net/);
  assert.ok(store.has("brainGames.guest"));
});

test("uploadGuest without guest data does nothing", async () => {
  const { api, calls } = rig({}, live);
  await api.uploadGuest("ana");
  assert.strictEqual(calls.length, 0);
});
