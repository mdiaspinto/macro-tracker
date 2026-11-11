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

  return { streak, streakHistory, dayStar };
})();
if (typeof module !== "undefined") module.exports = Game; else window.Game = Game;
