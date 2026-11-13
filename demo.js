// Guest demo: a sample week and fresh-account state. Pure functions, no DOM/network.
// In node, Brain and Shop come from require; in the browser they are globals loaded before this file.
const Demo = (() => {
  const B = typeof Brain !== "undefined" ? Brain : require("./brain.js");
  const S = typeof Shop !== "undefined" ? Shop : require("./shop.js");

  const KEY = "macroTracker.demo.v1", BACKUP_KEY = "macroTracker.v1.backup";
  const TARGETS = { lean: { p: 150, c: 200, f: 60 }, bulk: { p: 160, c: 220, f: 65 } };

  // Foods: [en, es, p, c, f] per 100 g.
  const F = {
    oats: ["Oatmeal with blueberries", "Avena con arándanos", 6, 20, 3],
    salmon: ["Salmon with spinach and olive oil", "Salmón con espinacas y aceite de oliva", 16, 3, 9],
    lentils: ["Lentils with carrots", "Lentejas con zanahorias", 9, 16, 1],
    chicken: ["Chicken with brown rice and broccoli", "Pollo con arroz integral y brócoli", 16, 14, 3],
    almonds: ["Almonds and yogurt", "Almendras y yogur", 8, 8, 9],
    tuna: ["Tuna salad", "Ensalada de atún", 14, 5, 5],
    cake: ["Chocolate cake", "Tarta de chocolate", 5, 50, 18],
    fries: ["Chicken with french fries", "Pollo con patatas fritas", 16, 20, 12],
    chickpeas: ["Chickpea stew with spinach", "Guiso de garbanzos con espinacas", 8, 15, 3],
    turkey: ["Turkey sandwich on whole wheat bread", "Bocadillo de pavo con pan integral", 16, 25, 4],
    omelette: ["Egg omelette with mushrooms", "Tortilla de huevo con champiñones", 12, 2, 9],
    yogurt: ["Greek yogurt with strawberries", "Yogur griego con fresas", 8, 10, 3],
  };
  // Meals per day offset -6..0: [food, grams].
  const PLAN = {
    "-6": [["oats", 400], ["tuna", 350], ["chicken", 450], ["almonds", 250]],
    "-5": [["yogurt", 300], ["lentils", 400], ["salmon", 400], ["almonds", 250]],
    "-4": [["oats", 400], ["chickpeas", 450], ["omelette", 300], ["cake", 100]],
    "-3": [["yogurt", 300], ["turkey", 350], ["salmon", 400], ["almonds", 250]],
    "-2": [["oats", 400], ["fries", 250], ["lentils", 400], ["almonds", 250]],
    "-1": [["yogurt", 300], ["tuna", 350], ["chicken", 450], ["almonds", 250]],
    "0": [["oats", 400], ["salmon", 400]],
  };
  // Habits per day offset: walk 5, sleep 6, strength 2, social 1, mind 2 over the 7 days.
  const HABITS = {
    "-6": ["walk", "sleep", "strength"], "-5": ["walk", "sleep", "mind"], "-4": ["social"],
    "-3": ["walk", "sleep", "strength"], "-2": ["sleep"], "-1": ["walk", "sleep", "mind"], "0": ["walk", "sleep"],
  };
  const WEIGHTS = { "-6": 72.0, "-4": 71.8, "-2": 71.6, "-1": 71.4 };

  // Local-date helpers (never new Date(string)).
  const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number), dt = new Date(y, m - 1, d + n);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); };

  const round1 = n => Math.round(n * 10) / 10;

  function sampleUser(name, lang, today, makeUser) {
    const user = makeUser(name, lang, Object.assign({}, TARGETS.lean), Object.assign({}, TARGETS.bulk));
    user.targets = { lean: Object.assign({}, TARGETS.lean), bulk: Object.assign({}, TARGETS.bulk) };
    user.days = {}; user.habits = {}; user.weights = {};
    for (let off = -6; off <= 0; off++) {
      const date = addDays(today, off);
      user.days[date] = PLAN[off].map(([key, qty], i) => {
        const f = F[key], nm = lang === "es" ? f[1] : f[0], k = qty / 100;
        return { id: "demo-" + date + "-" + i, name: nm, p: f[2], c: f[3], f: f[4], ref: 100, qty, unit: "g",
          ap: round1(f[2] * k), ac: round1(f[3] * k), af: round1(f[4] * k), eaten: true, brain: B.detectTags(nm) };
      });
      user.habits[date] = {};
      HABITS[off].forEach(h => { user.habits[date][h] = true; });
      if (WEIGHTS[off] !== undefined) user.weights[date] = WEIGHTS[off];
    }
    user.collectionBg = "plain";
    user.demoBuilt = today;
    user.shop = { start: today, startPoints: B.lifetimePoints(user, today), pulls: {} };
    return user;
  }

  function refresh(demoUser, today, makeUser) {
    const fresh = sampleUser(demoUser.name, demoUser.lang, today, makeUser);
    fresh.id = demoUser.id;
    fresh.collectionBg = demoUser.collectionBg;
    if (demoUser.demoTourDone) fresh.demoTourDone = demoUser.demoTourDone;
    const pulls = (demoUser.shop && demoUser.shop.pulls) || {};
    const spent = S.balance(demoUser, today, 0).spent;
    fresh.shop = { start: today, startPoints: B.lifetimePoints(fresh, today) - spent, pulls };
    return fresh;
  }

  const stateOf = user => ({ users: [user], activeId: user.id,
    migrations: { clearedSeedFoods: true, setupProfiles: true, fixProfileTargets: true, profileFromBio: true } });

  function accountState(demoUser, today, tourVersion, makeUser) {
    const user = makeUser(demoUser.name, demoUser.lang, Object.assign({}, TARGETS.lean), Object.assign({}, TARGETS.bulk));
    const pulls = (demoUser.shop && demoUser.shop.pulls) || {};
    const spent = S.balance(demoUser, today, 0).spent;
    user.goal = "lean";
    user.tourSeen = true; user.tourSeenV = tourVersion;
    user.collectionBg = demoUser.collectionBg || "plain";
    user.shop = { start: today, startPoints: -spent, pulls };
    return stateOf(user);
  }

  function usernameFrom(name) {
    const s = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
      .replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/^_+|_+$/g, "").slice(0, 20);
    return s.length < 2 ? "" : s;
  }

  function hasRealData(state) {
    const users = (state && Array.isArray(state.users)) ? state.users : [];
    return users.some(u => {
      if (!u) return false;
      const days = u.days || {}, habits = u.habits || {};
      return Object.keys(days).some(d => Array.isArray(days[d]) && days[d].length > 0)
        || Object.keys(u.weights || {}).length > 0
        || (Array.isArray(u.foods) && u.foods.length > 0)
        || Object.keys(habits).some(d => Object.values(habits[d] || {}).includes(true))
        || Object.keys((u.shop && u.shop.pulls) || {}).length > 0;
    });
  }

  return { KEY, BACKUP_KEY, TARGETS, stateOf, sampleUser, refresh, accountState, usernameFrom, hasRealData };
})();
if (typeof module !== "undefined") module.exports = Demo; else window.Demo = Demo;
