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

  // Badge families: each tier is its own badge key (keys double as celebration keys, so old saves keep matching).
  const weekFam = (id, icon, kind, tiers, keys, test) => ({ id, icon, kind, tiers, keys, test });
  const cat = c => w => w.fill[c] >= 1, W = [1, 4, 12];
  const FAMILIES = [
    { id: "firstLog", icon: "star", kind: "once", tiers: [1], keys: ["firstLog"] },
    { id: "streak", icon: "flame", kind: "run", tiers: [7, 30, 100], keys: ["streak7", "streak30", "streak100"] },
    { id: "stars", icon: "target", kind: "starRun", tiers: [7, 14, 30], keys: ["macroMaster", "stars14", "stars30"] },
    weekFam("fullBrain", "brain-circuit", "weeks", W, ["fullBrain", "fullBrain4", "fullBrain12"], w => w.full),
    weekFam("clean", "shield-check", "weeks", W, ["cleanWeek", "clean4", "clean12"], w => w.clean),
    weekFam("fish", "fish", "weeks", W, ["fishWeek", "fish4", "fish12"], cat("fish")),
    weekFam("strength", "dumbbell", "weeks", W, ["strongWeek", "strength4", "strength12"], cat("strength")),
    weekFam("berries", "cherry", "weeks", W, ["berries1", "berryLover", "berries12"], cat("berries")),
    weekFam("greens", "salad", "weeks", W, ["greens1", "greenMachine", "greens12"], cat("greens")),
    weekFam("social", "heart-handshake", "weeks", W, ["social1", "socialButterfly", "social12"], cat("social")),
  ];
  const LEGACY_KEYS = ["firstLog", "streak7", "streak30", "fishWeek", "fullBrain", "cleanWeek", "strongWeek", "berryLover", "greenMachine", "socialButterfly", "macroMaster"];
  const BADGES = [].concat(...FAMILIES.map(f => f.keys.map((id, i) => ({ id, family: f.id, tier: f.kind === "once" ? 0 : i + 1, icon: f.icon }))))
    .concat(B.LEVELS.slice(1).map(l => ({ id: "level:" + l.id, family: "level", tier: 0, icon: l.icon })));

  // Mon-Sun weekScores from the first week with any data through today's week (computed once per call).
  function weekScores(user, today) {
    const days = (user && user.days) || {}, habits = (user && user.habits) || {};
    const keys = Object.keys(days).filter(d => logged(user, d)).concat(Object.keys(habits).filter(d => Object.values(habits[d] || {}).includes(true))).filter(d => d <= today).sort();
    const out = [];
    if (keys.length) for (let w = B.weekStart(keys[0]), last = B.weekStart(today); w <= last; w = addDays(w, 7)) out.push(B.weekScore(user, w));
    return out;
  }

  // Same backward rule as streak() over precomputed arrays (lg: logged flags, wk: week starts, index 0 = earliest day);
  // stops once the count reaches cap. Index arithmetic keeps scanning every day cheap.
  function runCount(lg, wk, from, cap) {
    let c = 0, gapWeek = null;
    for (let i = from; i >= 0; i--) {
      if (lg[i]) { if (++c >= cap) return c; continue; }
      if (gapWeek === wk[i]) return c;
      gapWeek = wk[i];
    }
    return c;
  }

  // One scan: badge list plus the longest run / qualifying-week count per family (have).
  function scan(user, today) {
    const ws = weekScores(user, today), first = earliest(user), days = [], date = {}, have = {};
    if (first) for (let d = first; d <= today; d = addDays(d, 1)) days.push(d);
    const top = n => n[n.length - 1];
    const streakF = FAMILIES[1], starF = FAMILIES[2];
    // streak: first day whose (capped) run count reaches each tier
    have.streak = 0;
    const lg = days.map(d => logged(user, d)), wk = days.map(d => B.weekStart(d));
    for (let i = 0; i < days.length; i++) {
      if (!lg[i]) continue;
      const d = days[i], c = runCount(lg, wk, i, top(streakF.tiers));
      if (c > have.streak) { for (let i = 0; i < streakF.tiers.length; i++) if (!date[streakF.keys[i]] && c >= streakF.tiers[i]) date[streakF.keys[i]] = d; have.streak = c; }
    }
    let run = 0; have.stars = 0;
    for (const d of days) {
      run = dayStar(user, d) ? run + 1 : 0;
      if (run > have.stars) { have.stars = run; for (let i = 0; i < starF.tiers.length; i++) if (!date[starF.keys[i]] && run >= starF.tiers[i]) date[starF.keys[i]] = d; }
    }
    have.firstLog = first && first <= today ? 1 : 0;
    if (have.firstLog) date.firstLog = first;
    FAMILIES.filter(f => f.kind === "weeks").forEach(f => {
      const q = ws.filter(f.test); have[f.id] = q.length;
      f.tiers.forEach((n, i) => { if (q.length >= n) date[f.keys[i]] = q[n - 1].start; });
    });
    let cum = 0; const levelAt = {};
    ws.forEach(w => { cum += w.points; B.LEVELS.forEach(l => { if (l.min > 0 && cum >= l.min && !levelAt[l.id]) levelAt[l.id] = w.start; }); });
    B.LEVELS.forEach(l => { date["level:" + l.id] = levelAt[l.id] || null; });
    return { list: BADGES.map(b => ({ id: b.id, earned: !!date[b.id], date: date[b.id] || null })), have };
  }

  const badges = (user, today) => scan(user, today).list;

  // Per family: highest earned tier (a celebrated key counts), longest run / weeks so far, next threshold.
  function familyStatus(user, today, badgeList, celebrated) {
    const done = celebrated || {}, by = {}, sc = scan(user, today), have = sc.have;
    (badgeList || sc.list).forEach(b => { by[b.id] = b; });
    return FAMILIES.map(f => {
      const tiers = f.keys.map((key, i) => ({ key, need: f.tiers[i], earned: !!((by[key] && by[key].earned) || done[key]), date: (by[key] && by[key].date) || null }));
      let tier = 0; tiers.forEach((t, i) => { if (t.earned) tier = i + 1; });
      return { id: f.id, icon: f.icon, tier, have: have[f.id] || 0, need: tier < tiers.length ? tiers[tier].need : null, tiers };
    });
  }

  // First load after the tier release: mark already-earned NEW family keys celebrated so no toast burst appears.
  function seedNewTiers(user, today, badgeList) {
    if (!user) return false;
    if (user.celebrated && user.celebrated["tiers:v1"]) return false;
    if (!user.celebrated) user.celebrated = {};
    const fam = {}; FAMILIES.forEach(f => f.keys.forEach(k => { fam[k] = true; }));
    (badgeList || badges(user, today)).forEach(b => { if (b.earned && fam[b.id] && LEGACY_KEYS.indexOf(b.id) < 0) user.celebrated[b.id] = today; });
    user.celebrated["tiers:v1"] = today;
    return true;
  }

  // Union of two celebrated maps. The seed marker survives only if both sides hold it, so merged data is re-seeded silently.
  function mergeCelebrated(primary, secondary) {
    const out = Object.assign({}, secondary, primary);
    if (!(primary && primary["tiers:v1"] && secondary && secondary["tiers:v1"])) delete out["tiers:v1"];
    return out;
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

  return { streak, streakHistory, dayStar, FAMILIES, LEGACY_KEYS, BADGES, badges, familyStatus, seedNewTiers, mergeCelebrated, newCelebrations, celebrationKey };
})();
if (typeof module !== "undefined") module.exports = Game; else window.Game = Game;
