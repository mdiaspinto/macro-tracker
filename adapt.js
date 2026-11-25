// Adaptive weekly macros: the rule that sets next week's targets. Pure functions, no DOM/network; callers pass today as "YYYY-MM-DD".
const Adapt = (() => {
  const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtDate = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
  const kcal = t => t.p * 4 + t.c * 4 + t.f * 9;

  const KCAL_PER_KG_WEEK = 7700 / 7;            // daily kcal that moves the weight 1 kg in a week
  const RATE = { lean: -0.005, bulk: 0.0025 };  // goal pace: share of body weight per week
  const STEP = 150, MIN_STEP = 25;              // largest and smallest weekly change, kcal per day
  const MIN_DAYS = 4;                           // logged days needed in the week
  const FLOOR_KCAL = 1200, FLOOR_SHARE = 0.75;  // a cut never goes below either one
  const P_MIN = 1.6, P_STEP = 10;               // protein g per kg; largest weekly protein raise, g
  const CARB_MIN = 60, FAT_MIN = 0.6;           // carbs g; fat g per kg

  // The unveil week is named by its Sunday.
  const weekKey = today => addDays(today, -parseDate(today).getDay());
  // On by default: only an explicit on:false turns it off.
  const due = (user, today) => { const a = (user && user.adaptive) || {}; return a.on !== false && a.week !== weekKey(today); };

  // The 7 days before today: days with eaten food, their average kcal, and the latest weight on record.
  function week(user, today) {
    const days = (user && user.days) || {}, totals = [];
    for (let d = addDays(today, -7); d < today; d = addDays(d, 1)) {
      const eaten = (Array.isArray(days[d]) ? days[d] : []).filter(m => m && m.eaten === true);
      if (eaten.length) totals.push(eaten.reduce((a, m) => a + kcal({ p: +m.ap || 0, c: +m.ac || 0, f: +m.af || 0 }), 0));
    }
    const w = (user && user.weights) || {}, last = Object.keys(w).filter(d => d <= today).sort().pop();
    return { loggedDays: totals.length, avgIntake: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0, kg: last ? w[last] : null };
  }

  // in: { goal, targets:{p,c,f}, kg, maintenance (measured kcal, or null), avgIntake, loggedDays, first, feedback:{hungry,lowEnergy} }
  // reason: first | fewDays | noData | offTarget | holdFeedback | halfCut | cut | raise | floor | onPace
  function plan(input) {
    const from = input.targets, kt = kcal(from), fb = input.feedback || {}, kg = input.kg, bulk = input.goal === "bulk";
    const out = (reason, to, extra) => Object.assign({ reason, from, to, kcalFrom: kt, kcalTo: kcal(to),
      changed: to.p !== from.p || to.c !== from.c || to.f !== from.f, capped: false, floored: false, protein: false }, extra);
    if (input.first) return out("first", from);
    if (!(input.loggedDays >= MIN_DAYS)) return out("fewDays", from);
    if (!(input.maintenance > 0) || !(kg > 0)) return out("noData", from);

    let delta = input.maintenance + (bulk ? RATE.bulk : RATE.lean) * kg * KCAL_PER_KG_WEEK - kt, reason, capped = false, floored = false;
    // A new target does not help when the food eaten was far from the old one.
    if (bulk ? delta > 0 && input.avgIntake < 0.9 * kt : delta < 0 && input.avgIntake > 1.1 * kt) return out("offTarget", from);
    if (delta >= 0) reason = "raise";
    else if (fb.hungry && fb.lowEnergy) { reason = "holdFeedback"; delta = 0; }
    else if (fb.hungry || fb.lowEnergy) { reason = "halfCut"; delta /= 2; }
    else reason = "cut";
    if (Math.abs(delta) > STEP) { delta = Math.sign(delta) * STEP; capped = true; }
    const floor = Math.max(FLOOR_KCAL, FLOOR_SHARE * input.maintenance);
    if (delta < 0 && kt + delta < floor) { delta = Math.min(0, floor - kt); floored = true; }
    if (Math.abs(delta) < MIN_STEP) {
      delta = 0; capped = false;
      if (reason !== "holdFeedback") reason = floored ? "floor" : "onPace";
    }

    // Protein stays, unless it is under the minimum. Carbs take the change first, then fat down to its floor.
    const dp = from.p / kg < P_MIN ? Math.min(P_STEP, Math.ceil(P_MIN * kg - from.p)) : 0;
    let c = from.c + Math.round((delta - 4 * dp) / 4), f = from.f;
    if (c < CARB_MIN) {
      const lo = Math.min(from.c, CARB_MIN), rest = (c - lo) * 4;
      c = lo;
      f = from.f + Math.max(Math.round(rest / 9), Math.min(0, Math.ceil(FAT_MIN * kg) - from.f));
    }
    return out(reason, { p: from.p + dp, c, f }, { capped, floored, protein: dp > 0 });
  }

  // adaptive = { on, week (last unveiled Sunday), at (ms of the last change) }: the later change wins.
  function mergeAdaptive(a, b) {
    if (!a || !b) return a || b;
    return (b.at || 0) > (a.at || 0) ? b : a;
  }

  return { weekKey, due, week, plan, mergeAdaptive, kcal };
})();
if (typeof module !== "undefined") module.exports = Adapt; else window.Adapt = Adapt;
