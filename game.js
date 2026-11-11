// Streaks and macro stars (derived, never stored). Pure functions, no DOM/network; callers pass today as "YYYY-MM-DD".
const Game = (() => {
  const B = typeof require !== "undefined" ? require("./brain.js") : window.Brain;
  const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtDate = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
  const eatenMeals = (user, date) => { const v = user && user.days && user.days[date]; return Array.isArray(v) ? v.filter(m => m && m.eaten === true) : []; };
  const logged = (user, date) => eatenMeals(user, date).length > 0;
  const earliest = user => Object.keys((user && user.days) || {}).filter(d => logged(user, d)).sort()[0];

  // Walk back from today: unlogged today is skipped; per Mon-Sun week the first gap is forgiven, a second ends the run.
  function streak(user, today) {
    const first = earliest(user);
    if (!first) return 0;
    let n = 0, d = today, gapWeek = null;
    if (!logged(user, d)) d = addDays(d, -1);
    for (; d >= first; d = addDays(d, -1)) {
      if (logged(user, d)) { n++; continue; }
      const w = B.weekStart(d);
      if (gapWeek === w) break;
      gapWeek = w;
    }
    return n;
  }

  // Streak as of every day from the earliest eaten day through today. Computed with the backward walk per day
  // (a single forward pass can't match it: which gap in a week is "first" depends on the direction of travel).
  function streakHistory(user, today) {
    const out = {}, first = earliest(user);
    if (!first) return out;
    for (let d = first; d <= today; d = addDays(d, 1)) out[d] = streak(user, d);
    return out;
  }

  function dayStar(user, date) {
    const meals = eatenMeals(user, date), t = user && user.targets && user.targets[user.goal];
    if (!meals.length || !t) return false;
    const sum = k => meals.reduce((a, m) => a + (Number(m[k]) || 0), 0);
    const p = sum("ap"), kcal = p * 4 + sum("ac") * 4 + sum("af") * 9, target = t.p * 4 + t.c * 4 + t.f * 9;
    return Math.abs(kcal - target) <= 0.1 * target && p >= 0.9 * t.p;
  }

  const BADGES = [
    ["firstLog", "🌟"], ["streak7", "🔥"], ["streak30", "🏅"], ["fishWeek", "🐟"], ["fullBrain", "🧠"], ["cleanWeek", "🧼"],
    ["strongWeek", "🏋️"], ["berryLover", "🫐"], ["greenMachine", "🥬"], ["socialButterfly", "🦋"], ["macroMaster", "🎯"],
  ].map(([id, emoji]) => ({ id, emoji })).concat(B.LEVELS.slice(1).map(l => ({ id: "level:" + l.id, emoji: l.emoji })));

  // Mon-Sun weekScores from the first week with any data through today's week (computed once per call).
  function weekScores(user, today) {
    const days = (user && user.days) || {}, habits = (user && user.habits) || {};
    const keys = Object.keys(days).filter(d => logged(user, d)).concat(Object.keys(habits).filter(d => Object.values(habits[d] || {}).includes(true))).filter(d => d <= today).sort();
    const out = [];
    if (keys.length) for (let w = B.weekStart(keys[0]), last = B.weekStart(today); w <= last; w = addDays(w, 7)) out.push(B.weekScore(user, w));
    return out;
  }

  // Same backward rule as streak(), but stops once the count reaches n (so scanning every day stays linear).
  function reaches(user, from, n, first) {
    let c = 0, gapWeek = null;
    for (let d = from; d >= first; d = addDays(d, -1)) {
      if (logged(user, d)) { if (++c >= n) return true; continue; }
      const w = B.weekStart(d);
      if (gapWeek === w) return false;
      gapWeek = w;
    }
    return false;
  }

  function badges(user, today) {
    const ws = weekScores(user, today), first = earliest(user), days = [];
    const firstWeek = f => { const w = ws.find(f); return w ? w.start : null; };
    const fourth = id => { const q = ws.filter(w => w.fill[id] >= 1); return q.length >= 4 ? q[3].start : null; };
    if (first) for (let d = first; d <= today; d = addDays(d, 1)) days.push(d);
    const reach = n => days.find(d => logged(user, d) && reaches(user, d, n, first)) || null;
    let run = 0, master = null;
    for (const d of days) { run = dayStar(user, d) ? run + 1 : 0; if (run === 7) { master = d; break; } }
    let cum = 0; const levelAt = {};
    ws.forEach(w => { cum += w.points; B.LEVELS.forEach(l => { if (l.min > 0 && cum >= l.min && !levelAt[l.id]) levelAt[l.id] = w.start; }); });
    const date = {
      firstLog: first && first <= today ? first : null, streak7: reach(7), streak30: reach(30),
      fishWeek: firstWeek(w => w.fill.fish >= 1), strongWeek: firstWeek(w => w.fill.strength >= 1),
      fullBrain: firstWeek(w => w.full), cleanWeek: firstWeek(w => w.clean),
      berryLover: fourth("berries"), greenMachine: fourth("greens"), socialButterfly: fourth("social"), macroMaster: master,
    };
    B.LEVELS.forEach(l => { date["level:" + l.id] = levelAt[l.id] || null; });
    return BADGES.map(b => ({ id: b.id, earned: !!date[b.id], date: date[b.id] || null }));
  }

  const celebrationKey = c => c.type === "level" ? "level:" + c.id : c.type === "fullWeek" ? "week:" + c.id : c.id;

  // Earned badges / reached levels / the current week's full bar that aren't yet in user.celebrated.
  function newCelebrations(user, today, badgeList) {
    const done = (user && user.celebrated) || {}, out = [];
    (badgeList || badges(user, today)).filter(b => b.earned).forEach(b => out.push(b.id.startsWith("level:") ? { type: "level", id: b.id.slice(6) } : { type: "badge", id: b.id }));
    const cur = B.weekScore(user, today);
    if (cur.full) out.push({ type: "fullWeek", id: cur.start });
    return out.filter(c => !done[celebrationKey(c)]);
  }

  return { streak, streakHistory, dayStar, BADGES, badges, newCelebrations, celebrationKey };
})();
if (typeof module !== "undefined") module.exports = Game; else window.Game = Game;
