// Firebase sync for the brain site: sign-in, profiles, PATCH-only writes under /brain/<uid>/<key>.
// Never writes /users/<uid> and never writes or removes macroTracker.session.
const Sync = (() => {
  const B = typeof require !== "undefined" ? require("../brain.js") : window.Brain;
  const S = typeof require !== "undefined" ? require("./session.js") : window.Session;
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
      return { sessions: (d && d.sessions) || {}, progress: (d && d.progress) || null };
    }
    async function saveDay(key, date, day) {
      const path = base(key);
      if (!goodDate(date)) throw new Error("bad-path");
      const body = Object.assign({}, day);
      if (body.completedAt == null) delete body.completedAt;   // PATCH null would delete a remote completion
      await patch(path + "/sessions/" + date, body);
    }
    const saveProgress = async (key, progress) => patch(base(key) + "/progress", progress);

    async function uploadGuest(key) {
      const g = read(GUEST);
      if (!g) return;
      const days = g.days || {};
      if (!Object.keys(days).every(goodDate)) throw new Error("bad-path");
      const remote = await load(key);
      for (const date of Object.keys(days)) {
        const have = remote.sessions[date];
        await saveDay(key, date, have ? S.mergeDay(have, days[date]) : days[date]);
      }
      if (g.progress && !remote.progress) await saveProgress(key, g.progress);
      storage.removeItem(GUEST);
    }

    return {
      session, trackerSession, pin: () => { const s = session(); pinned = s ? s.uid : null; }, useTrackerSession, signOut, profiles, load, saveDay, saveProgress, uploadGuest,
      signUp: (u, pw) => authCall("signUp", u, pw),
      signIn: (u, pw) => authCall("signInWithPassword", u, pw),
    };
  }
  return { create };
})();
if (typeof module !== "undefined") module.exports = Sync; else window.Sync = Sync;
