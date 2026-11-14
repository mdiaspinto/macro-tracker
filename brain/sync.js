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
    let refreshing = null;

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
      const s = { username: u, uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, expiresAt: now() + j.expiresIn * 1000 };
      write(SESSION, s);
      return s;
    }

    async function idToken() {
      const s = session();
      if (!s) throw new Error("signed-out");
      if (s.expiresAt - 60000 > now()) return s.idToken;
      if (!refreshing) {
        refreshing = (async () => {
          let r;
          try {
            r = await fetch("https://securetoken.googleapis.com/v1/token?key=" + firebase.apiKey, {
              method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(s.refreshToken),
            });
          } catch (e) { throw new Error("net"); }
          if (r.status === 400) { signOut(); throw new Error("signed-out"); }
          if (!r.ok) throw new Error("net");
          const j = await r.json();
          const next = Object.assign({}, s, { idToken: j.id_token, refreshToken: j.refresh_token, expiresAt: now() + j.expires_in * 1000 });
          write(SESSION, next);
          return next.idToken;
        })().finally(() => { refreshing = null; });
      }
      return refreshing;
    }

    async function dbFetch(path, opts) {
      const token = await idToken();
      let r;
      try { r = await fetch(db + path + ".json?auth=" + encodeURIComponent(token), Object.assign({ cache: "no-store" }, opts)); }
      catch (e) { throw new Error("net"); }
      if (!r.ok) throw new Error("net");
      return r.json();
    }
    const patch = (path, value) => dbFetch(path, { method: "PATCH", headers: JSON_HEAD, body: JSON.stringify(value) });
    const base = (key) => "/brain/" + session().uid + "/" + encodeURIComponent(key);

    async function profiles() {
      const s = session();
      if (!s) throw new Error("signed-out");
      const data = await dbFetch("/users/" + s.uid);
      const users = data && data.state && Array.isArray(data.state.users) ? data.state.users : [];
      if (!users.length) return [{ key: B.profileKey(s.username), name: s.username, lang: null }];
      return users.map((u) => ({ key: B.profileKey(u.name), name: u.name, lang: u.lang || null }));
    }

    async function load(key) {
      await idToken();
      const d = await dbFetch(base(key));
      return { sessions: (d && d.sessions) || {}, progress: (d && d.progress) || null };
    }
    const saveDay = async (key, date, day) => { await idToken(); await patch(base(key) + "/sessions/" + date, day); };
    const saveProgress = async (key, progress) => { await idToken(); await patch(base(key) + "/progress", progress); };

    async function uploadGuest(key) {
      const g = read(GUEST);
      if (!g) return;
      const remote = await load(key);
      const days = g.days || {};
      for (const date of Object.keys(days)) {
        const have = remote.sessions[date];
        await saveDay(key, date, have ? S.mergeDay(have, days[date]) : days[date]);
      }
      if (g.progress && !remote.progress) await saveProgress(key, g.progress);
      storage.removeItem(GUEST);
    }

    return {
      session, trackerSession, useTrackerSession, signOut, profiles, load, saveDay, saveProgress, uploadGuest,
      signUp: (u, pw) => authCall("signUp", u, pw),
      signIn: (u, pw) => authCall("signInWithPassword", u, pw),
    };
  }
  return { create };
})();
if (typeof module !== "undefined") module.exports = Sync; else window.Sync = Sync;
