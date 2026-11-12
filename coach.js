// AI coach: the compact summary the Worker sees (pure), the daily note and the chat requests. No DOM.
const Coach = (() => {
  const B = typeof require !== "undefined" ? require("./brain.js") : window.Brain;
  const G = typeof require !== "undefined" ? require("./game.js") : window.Game;
  const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtDate = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
  const eatenMeals = (user, date) => { const v = user && user.days && user.days[date]; return Array.isArray(v) ? v.filter(m => m && m.eaten === true) : []; };
  const langOf = user => (user && user.lang === "es" ? "es" : "en");
  const NOTE_DAYS = 14, CHAT_SENT = 10, MEMORY_MAX = 15, DECLINED_MAX = 30, FACT_LEN = 80;

  // Remembered facts (profile.memory) and ones the person said no to (profile.memoryDeclined).
  const list = v => (Array.isArray(v) ? v.filter(x => typeof x === "string" && x.trim()) : []);
  const normFact = text => String(text == null ? "" : text).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim().replace(/^[\s¡¿"']+/, "").replace(/[\s.,;:!?…"'¡¿]+$/, "");
  const cleanFact = text => String(text == null ? "" : text).replace(/\s+/g, " ").trim().slice(0, FACT_LEN).trim();
  const has = (arr, text) => { const n = normFact(text); return arr.some(x => normFact(x) === n); };
  function canSuggest(profile, text) {
    const p = profile || {}, mem = list(p.memory);
    return !!normFact(text) && mem.length < MEMORY_MAX && !has(mem, text) && !has(list(p.memoryDeclined), text);
  }
  function addMemory(profile, text) {
    const mem = list((profile || {}).memory), fact = cleanFact(text);
    return !fact || has(mem, fact) || mem.length >= MEMORY_MAX ? mem : mem.concat(fact);
  }
  function removeMemory(profile, which) {
    const mem = list((profile || {}).memory);
    if (typeof which === "number") return mem.filter((_, i) => i !== which);
    const n = normFact(which);
    return mem.filter(x => normFact(x) !== n);
  }
  function declineMemory(profile, text) {
    const d = list((profile || {}).memoryDeclined), fact = cleanFact(text);
    return !fact || has(d, fact) ? d : d.concat(fact).slice(-DECLINED_MAX);
  }
  // Save a (possibly edited) fact: also drops it from the declined list, so a fact is never in both.
  function saveFact(profile, text) {
    const p = profile || {}, mem = list(p.memory), declined = list(p.memoryDeclined), fact = cleanFact(text);
    const n = normFact(fact), left = declined.filter(x => normFact(x) !== n);
    if (!n) return { status: "empty", memory: mem, memoryDeclined: declined };
    if (has(mem, fact)) return { status: "duplicate", memory: mem, memoryDeclined: left };
    if (mem.length >= MEMORY_MAX) return { status: "full", memory: mem, memoryDeclined: declined };
    return { status: "added", memory: mem.concat(fact), memoryDeclined: left };
  }
  // Remove a remembered fact by text and keep it from being proposed again.
  function forgetFact(profile, text) {
    const p = profile || {}, n = normFact(text), stored = list(p.memory).filter(x => normFact(x) === n)[0];
    return { memory: removeMemory(p, text), memoryDeclined: declineMemory(p, stored || text) };
  }
  // A card's half-edited draft survives a re-render only for the same user, day, message and fact.
  const draftKey = (user, today, i, fact) => [user && user.id, today, i, normFact(fact)].join("|");
  const keepDraft = (prev, next) => typeof prev === "string" && typeof next === "string" && prev === next;
  const canRemember = draft => !!cleanFact(draft);
  // Index of the latest suggestion if nobody has answered it yet, else -1 (older suggestions are never revived).
  function pendingRemember(messages) {
    const ms = Array.isArray(messages) ? messages : [];
    for (let i = ms.length - 1; i >= 0; i--) {   // no findLastIndex: older iPhones
      const m = ms[i];
      if (m && m.role === "assistant" && m.remember) return m.rememberState ? -1 : i;
    }
    return -1;
  }

  // prof defaults to user.profile; familyHistory (when false) and notes (when empty) are left out.
  function summary(user, today, prof) {
    const u = user || {}, p = Object.assign({}, prof || u.profile || {});
    if (!p.familyHistory) delete p.familyHistory;
    if (!String(p.notes || "").trim()) delete p.notes;
    const mem = list(p.memory);
    if (mem.length) p.memory = mem; else delete p.memory;
    delete p.memoryDeclined;   // stays on the device: it only keeps the app from re-proposing, the model never needs it
    const ws = B.weekScore(u, today), lv = B.levelFor(B.lifetimePoints(u, today));
    const totals = d => {
      const ms = eatenMeals(u, d), sum = k => ms.reduce((a, m) => a + (Number(m[k]) || 0), 0);
      return { n: ms.length, kcal: sum("ap") * 4 + sum("ac") * 4 + sum("af") * 9, protein: sum("ap") };
    };
    // Weekly averages cover completed days only (Monday..yesterday); today's partial day is reported separately.
    let days = 0, kcal = 0, protein = 0;
    for (let d = ws.start; d < today; d = addDays(d, 1)) {
      const x = totals(d);
      if (x.n) { days++; kcal += x.kcal; protein += x.protein; }
    }
    const now = totals(today);
    const t = u.targets && u.targets[u.goal];
    return {
      profile: p,
      lang: langOf(u),
      week: {
        bar: Math.round(ws.bar * 100) / 100,
        missing: B.CATEGORIES.filter(c => ws.fill[c.id] < 1).map(c => ({ id: c.id, remaining: c.target - ws.counts[c.id] })),
      },
      streak: G.streak(u, today),
      level: lv.level.id,
      toNext: lv.toNext,
      macros: {
        avgKcal: days ? Math.round(kcal / days) : null,
        kcalTarget: t ? Math.round((Number(t.p) || 0) * 4 + (Number(t.c) || 0) * 4 + (Number(t.f) || 0) * 9) : null,
        avgProtein: days ? Math.round(protein / days) : null,
        proteinTarget: t ? Number(t.p) || 0 : null,
      },
      today: { kcal: Math.round(now.kcal), protein: Math.round(now.protein) },
      yesterday: eatenMeals(u, addDays(today, -1)).map(m => String(m.name || "").trim()).filter(Boolean).slice(0, 8),
    };
  }

  // Device merge: notes by date (primary wins per date); chat from the side with the later date (primary on tie).
  // Firebase drops empty objects/arrays, so anything missing counts as empty.
  function mergeCoach(primary, secondary) {
    const P = primary || {}, S = secondary || {}, out = { notes: Object.assign({}, S.notes, P.notes) };
    const chat = !P.chat ? S.chat : !S.chat ? P.chat : String(S.chat.date || "") > String(P.chat.date || "") ? S.chat : P.chat;
    if (chat) out.chat = chat;
    return out;
  }

  // Maps a Worker response to "ok" | "unavailable" (old Worker without coach kinds) | "capped" | "error".
  function classify(kind, status, body) {
    const b = body || {};
    if (status === 200) {
      if (kind === "note") return typeof b.note === "string" && b.note.trim() ? "ok" : "error";
      return typeof b.reply === "string" && b.reply.trim() ? "ok" : "error";
    }
    if (status === 400 && b.error === "no_facts") return "unavailable";
    if (status === 429 && b.error === "daily_limit") return "capped";
    return "error";
  }

  /* ---- network glue (browser) ---- */
  // cfg: {url, getToken, hasSession, getProfile(user), getUser(id), onChange}
  let cfg = {}, unavailable = false;
  const tried = new Set(), capped = new Set(), left = {};
  const keyOf = (user, today) => user.id + ":" + today;
  const changed = () => { if (cfg.onChange) cfg.onChange(); };
  const fresh = user => (cfg.getUser && cfg.getUser(user.id)) || user;   // a cloud pull may have replaced the object
  const profOf = user => (cfg.getProfile ? cfg.getProfile(user) : undefined);
  const ready = () => !!(cfg.url && !unavailable && (!cfg.hasSession || cfg.hasSession()));

  function init(options) { cfg = options || {}; unavailable = false; capped.clear(); }
  function coachOf(user) {
    if (!user.coach || typeof user.coach !== "object") user.coach = {};
    if (!user.coach.notes || typeof user.coach.notes !== "object") user.coach.notes = {};
    return user.coach;
  }
  function noteFor(user, today) { return (user && user.coach && user.coach.notes && user.coach.notes[today]) || null; }
  function chatFor(user, today) {
    const c = user && user.coach && user.coach.chat;
    return c && c.date === today && Array.isArray(c.messages) ? c.messages : [];
  }

  async function post(kind, payload) {
    try {
      const r = await fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + await cfg.getToken() },
        body: JSON.stringify(payload),
      });
      const body = await r.json().catch(() => ({}));
      return { status: classify(kind, r.status, body), body };
    } catch (e) {
      return { status: "error", body: {} };
    }
  }

  // At most one request per user per day per page load; failures fall back to the rule-based hint silently.
  async function ensureNote(user, today) {
    if (!user || !ready() || noteFor(user, today) || tried.has(keyOf(user, today))) return;
    tried.add(keyOf(user, today));
    const res = await post("note", { kind: "note", lang: langOf(user), summary: summary(user, today, profOf(user)) });
    if (res.status === "unavailable") { unavailable = true; changed(); return; }
    if (res.status !== "ok") return;
    const notes = coachOf(fresh(user)).notes, cutoff = addDays(today, -NOTE_DAYS);
    notes[today] = { note: res.body.note, tip: typeof res.body.tip === "string" ? res.body.tip : "" };
    Object.keys(notes).forEach(d => { if (d < cutoff) delete notes[d]; });
    changed();
  }

  function todayChat(user, today) {
    const c = coachOf(user);
    if (!c.chat || c.chat.date !== today) c.chat = { date: today, messages: [] };
    if (!Array.isArray(c.chat.messages)) c.chat.messages = [];
    return c.chat;
  }

  // Adds `text` (if any) as the user's message and asks for a reply; without text it retries the current history.
  // Rejects with err.kind = "capped" | "unavailable" | "error".
  async function send(user, today, text) {
    const fail = kind => Object.assign(new Error(kind), { kind });
    if (!ready()) throw fail(unavailable ? "unavailable" : "error");
    if (capped.has(keyOf(user, today))) throw fail("capped");
    const chat = todayChat(user, today);
    if (text) { chat.messages.push({ role: "user", text }); changed(); }
    const res = await post("chat", { kind: "chat", lang: langOf(user), summary: summary(user, today, profOf(user)), messages: chat.messages.slice(-CHAT_SENT) });
    if (res.status !== "ok") {
      if (res.status === "unavailable") unavailable = true;
      if (res.status === "capped") capped.add(keyOf(user, today));
      // No answer will ever come today: drop the question so a reload doesn't show it unanswered.
      if (text && (res.status === "capped" || res.status === "unavailable"))
        new Set([chat, todayChat(fresh(user), today)]).forEach(c => {
          for (let i = c.messages.length - 1; i >= 0; i--) {   // no findLastIndex: older iPhones (iOS < 15.4)
            const m = c.messages[i];
            if (m && m.role === "user" && m.text === text) { c.messages.splice(i, 1); break; }
          }
        });
      changed();
      throw fail(res.status);
    }
    const remaining = typeof res.body.remaining === "number" ? res.body.remaining : null;
    const msg = { role: "assistant", text: res.body.reply }, fu = fresh(user);
    const fact = typeof res.body.remember === "string" ? cleanFact(res.body.remember) : "";
    if (fact && canSuggest(profOf(fu) || fu.profile, fact)) msg.remember = fact;
    todayChat(fu, today).messages.push(msg);
    left[keyOf(user, today)] = remaining;
    changed();
    return { reply: res.body.reply, remaining };
  }

  const available = () => !unavailable;
  const isCapped = (user, today) => capped.has(keyOf(user, today));
  const remainingFor = (user, today) => { const n = left[keyOf(user, today)]; return typeof n === "number" ? n : null; };

  return { summary, normFact, canSuggest, addMemory, removeMemory, declineMemory, saveFact, forgetFact, memoryOf: p => list((p || {}).memory), draftKey, keepDraft, canRemember, pendingRemember, mergeCoach, classify, init, noteFor, chatFor, ensureNote, send, available, isCapped, remainingFor };
})();
if (typeof module !== "undefined") module.exports = Coach; else window.Coach = Coach;
