// Firebase sync for the brain site: sign-in, profiles, PATCH-only writes under /brain/<uid>/<key>.
// Never writes /users/<uid> and never writes or removes macroTracker.session.
const Sync = (() => {
  const B = typeof require !== "undefined" ? require("../brain.js") : window.Brain;
  const S = typeof require !== "undefined" ? require("./session.js") : window.Session;
  const Sc = typeof require !== "undefined" ? require("./score.js") : window.Score;
  const St = typeof require !== "undefined" ? require("./stats.js") : window.Stats;
  const Bd = typeof require !== "undefined" ? require("./board.js") : window.Board;
  const SESSION = "brainGames.session", PROFILE = "brainGames.profile", GUEST = "brainGames.guest";
  const TRACKER = "macroTracker.session";
  const normUser = (u) => String(u || "").trim().toLowerCase();
  const validUser = (u) => /^[a-z0-9_]{2,20}$/i.test(String(u || "").trim());
  const JSON_HEAD = { "Content-Type": "application/json" };

  function create({ fetch, storage, now, firebase }) {
    const read = (k) => { try { return JSON.parse(storage.getItem(k) || "null"); } catch (e) { return null; } };
    const write = (k, v) => storage.setItem(k, JSON.stringify(v));
    const db = firebase.databaseURL.replace(/\/+$/, "");
    let refreshing = null, pinned = null;   // pinned: uid of the open profile; writes refuse any other uid

    const session = () => read(SESSION);
    const trackerSession = () => {
      const s = read(TRACKER);
      return s && s.uid && s.refreshToken ? s : null;
    };
    function useTrackerSession() {
      const s = trackerSession();
      if (s) write(SESSION, s);
      return s;
    }
    function signOut() { storage.removeItem(SESSION); storage.removeItem(PROFILE); }

    async function authCall(op, username, pw) {
      if (!validUser(username)) throw new Error("invalid-username");
      const u = String(username).trim();
      let r;
      try {
        r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:" + op + "?key=" + firebase.apiKey, {
          method: "POST", headers: JSON_HEAD,
          body: JSON.stringify({ email: normUser(u) + "@" + firebase.emailDomain, password: pw, returnSecureToken: true }),
        });
      } catch (e) { throw new Error("net"); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && j.error.message) || "net");
      if (!j.idToken) throw new Error("net");
      const s = { username: u, uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, expiresAt: now() + j.expiresIn * 1000 };
      write(SESSION, s);
      return s;
    }

    async function idToken() {
      const s = session();
      if (!s) throw new Error("signed-out");
      if (s.expiresAt - 60000 > now()) return s.idToken;
      if (!refreshing || refreshing.rt !== s.refreshToken) {
        const p = (async () => {
          // The stored session must still be the one we refresh; else a sign-out or sign-in raced us.
          const same = () => { const c = session(); return !!c && c.uid === s.uid && c.refreshToken === s.refreshToken; };
          let r;
          try {
            r = await fetch("https://securetoken.googleapis.com/v1/token?key=" + firebase.apiKey, {
              method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(s.refreshToken),
            });
          } catch (e) { throw new Error("net"); }
          if (!same()) throw new Error("signed-out");
          if (r.status === 400) { signOut(); throw new Error("signed-out"); }
          if (!r.ok) throw new Error("net");
          let j;
          try { j = await r.json(); } catch (e) { throw new Error("net"); }
          if (!j || !j.id_token) throw new Error("net");
          if (!same()) throw new Error("signed-out");
          const next = Object.assign({}, s, { idToken: j.id_token, refreshToken: j.refresh_token, expiresAt: now() + j.expires_in * 1000 });
          write(SESSION, next);
          return next.idToken;
        })();
        refreshing = { rt: s.refreshToken, p };
        p.then(() => {}, () => {}).then(() => { if (refreshing && refreshing.p === p) refreshing = null; });
      }
      return refreshing.p;
    }

    // Writes use keepalive so a save sent on pagehide is not cancelled.
    async function dbFetch(path, opts) {
      const token = await idToken();
      let r;
      try { r = await fetch(db + path + ".json?auth=" + encodeURIComponent(token), Object.assign({ cache: "no-store" }, opts && opts.method ? { keepalive: true } : null, opts)); }
      catch (e) { throw new Error("net"); }
      if (!r.ok) throw new Error("net");
      try { return await r.json(); } catch (e) { throw new Error("net"); }
    }
    const patch = (path, value) => dbFetch(path, { method: "PATCH", headers: JSON_HEAD, body: JSON.stringify(value) });
    // Only well-formed profile keys and dates reach a URL: no empty or nested segments.
    const goodKey = (k) => typeof k === "string" && k !== "" && B.profileKey(k) === k;
    const goodDate = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
    function base(key) {
      if (!goodKey(key)) throw new Error("bad-path");
      const s = session();
      if (!s || (pinned && s.uid !== pinned)) throw new Error("signed-out");
      return "/brain/" + s.uid + "/" + encodeURIComponent(key);
    }

    async function profiles() {
      const s = session();
      if (!s) throw new Error("signed-out");
      const data = await dbFetch("/users/" + s.uid);
      const users = data && data.state && Array.isArray(data.state.users) ? data.state.users : [];
      if (!users.length) return [{ key: B.profileKey(s.username), name: s.username, lang: null }];
      return users.map((u) => ({ key: B.profileKey(u.name), name: u.name, lang: u.lang || null }));
    }

    async function load(key) {
      const d = await dbFetch(base(key));
      return { sessions: (d && d.sessions) || {}, progress: (d && d.progress) || null, best: (d && d.best) || {}, stats: (d && d.stats) || {} };
    }
    async function saveDay(key, date, day) {
      const path = base(key);
      if (!goodDate(date)) throw new Error("bad-path");
      const body = Object.assign({}, day);
      if (body.completedAt == null) delete body.completedAt;   // PATCH null would delete a remote completion
      await patch(path + "/sessions/" + date, body);
    }
    const saveProgress = async (key, progress) => patch(base(key) + "/progress", progress);

    async function saveStats(key, date, game, entry) {
      const path = base(key);
      if (!goodDate(date) || Bd.GAMES.indexOf(game) < 0) throw new Error("bad-path");
      await patch(path + "/stats/" + date + "/" + game, { n: entry.n, sum: entry.sum, best: entry.best });
    }

    // Leaderboard: reads need a session; writes also need a good game and the pinned uid.
    function uidFor() {
      const s = session();
      if (!s || (pinned && s.uid !== pinned)) throw new Error("signed-out");
      return s.uid;
    }
    const goodGame = (g) => Bd.GAMES.indexOf(g) >= 0;
    async function leaderboard() {
      uidFor();
      const d = await dbFetch("/leaderboard");
      const out = {};
      Bd.GAMES.forEach((g) => { out[g] = (d && d[g]) || {}; });
      return out;
    }
    async function postBoard(game, key, row) {
      if (!goodGame(game) || !goodKey(key)) throw new Error("bad-path");
      const uid = uidFor();
      await patch("/leaderboard/" + game + "/" + encodeURIComponent(Bd.entryKey(uid, key)), row);
    }
    async function removeBoard(game, entryKeys) {
      if (!goodGame(game)) throw new Error("bad-path");
      const uid = uidFor();
      if (!entryKeys.every((k) => typeof k === "string" && k.indexOf(uid + "_") === 0 && k.length > uid.length + 1)) throw new Error("bad-path");
      if (!entryKeys.length) return;
      const body = {};
      entryKeys.forEach((k) => { body[k] = null; });
      await patch("/leaderboard/" + game, body);
    }

    const goodBestId = (id) => typeof id === "string" && /^(peek|parade|names)$/.test(id);
    const goodBest = (id, rec) => goodBestId(id) && !!rec && typeof rec.score === "number" && isFinite(rec.score) && rec.score >= 0;
    // A stored record is replaced only by a higher score; the write is PATCH {score, points, len, at}.
    // points and len are optional: when missing or invalid they are left out and never block the save.
    const goodPoints = (n) => typeof n === "number" && isFinite(n) && n >= 0;
    const goodLen = (n) => typeof n === "number" && n % 1 === 0 && n >= 1 && n <= 5;
    async function saveBest(key, id, rec) {
      if (!goodBest(id, rec)) throw new Error("bad-path");
      const path = base(key) + "/best/" + id;
      const remote = await dbFetch(path);
      if (!Sc.isBetter(rec.score, remote)) return { saved: false, best: remote };
      const best = { score: rec.score };
      if (goodPoints(rec.points)) best.points = rec.points;
      if (goodLen(rec.len)) best.len = rec.len;
      best.at = rec.at != null ? rec.at : now();
      await patch(path, best);
      return { saved: true, best };
    }

    async function uploadGuest(key) {
      const g = read(GUEST);
      if (!g) return;
      const days = g.days || {};
      if (!Object.keys(days).every(goodDate)) throw new Error("bad-path");
      const guestBest = g.best && typeof g.best === "object" ? g.best : {};
      const bestIds = Object.keys(guestBest).filter((id) => goodBest(id, guestBest[id]));
      const guestStats = g.stats && typeof g.stats === "object" ? g.stats : {};
      if (!Object.keys(guestStats).every(goodDate)) throw new Error("bad-path");
      const remote = await load(key);
      for (const date of Object.keys(days)) {
        const have = remote.sessions[date];
        await saveDay(key, date, have ? S.mergeDay(have, days[date]) : days[date]);
      }
      if (g.progress && !remote.progress) await saveProgress(key, g.progress);
      for (const id of bestIds) await saveBest(key, id, guestBest[id]);
      for (const date of Object.keys(guestStats)) {
        for (const game of Object.keys(guestStats[date] || {}).filter((x) => Bd.GAMES.indexOf(x) >= 0)) {
          const have = remote.stats[date] && remote.stats[date][game];
          await saveStats(key, date, game, St.merge(have, guestStats[date][game]));
          dropGuestStats(date, game);   // gone at once, so a retry never adds this entry twice
        }
      }
      storage.removeItem(GUEST);
    }
    function dropGuestStats(date, game) {
      const cur = read(GUEST);
      if (!cur || !cur.stats || !cur.stats[date]) return;
      delete cur.stats[date][game];
      if (!Object.keys(cur.stats[date]).length) delete cur.stats[date];
      write(GUEST, cur);
    }

    return {
      session, trackerSession, pin: () => { const s = session(); pinned = s ? s.uid : null; }, useTrackerSession, signOut, profiles, load, saveDay, saveProgress, saveBest, saveStats, leaderboard, postBoard, removeBoard, uploadGuest,
      signUp: (u, pw) => authCall("signUp", u, pw),
      signIn: (u, pw) => authCall("signInWithPassword", u, pw),
    };
  }
  return { create };
})();
if (typeof module !== "undefined") module.exports = Sync; else window.Sync = Sync;
