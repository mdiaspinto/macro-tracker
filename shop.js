// Collection shop: character catalogue and box draw. Pure functions, no DOM/network, no dependency on Brain.
const Shop = (() => {
  const PRICE = 200, REFUND = 50, SECRET_P = 0.25, DUP_P = 0.10;
  const COLLECTIONS = [{ id: "lulu", name: "Lulu" }, { id: "kiki", name: "Kiki" }, { id: "momo", name: "Momo" }, { id: "nini", name: "Nini" }];
  // [en, es] per row, rows 1..6, keyed by collection
  const COMMON_NAMES = {
    lulu: [["Gym", "Gimnasio"], ["Doctor", "Médico"], ["Waiter", "Camarero"], ["Meditation", "Meditación"], ["Sprout", "Brote"], ["Cozy cocoa", "Chocolate calentito"]],
    kiki: [["Runner", "Carrera"], ["Nurse", "Enfermería"], ["Cook", "Cocina"], ["Tree pose", "Postura del árbol"], ["Recycling", "Reciclaje"], ["Bunny blanket", "Mantita de conejo"]],
    momo: [["Salad", "Ensalada"], ["Scientist", "Ciencia"], ["Explorer", "Explorador"], ["Business", "Negocios"], ["Superhero", "Superhéroe"], ["Tennis", "Tenis"]],
    nini: [["Hydration", "Hidratación"], ["Surgeon", "Cirugía"], ["Vacation", "Vacaciones"], ["Laptop", "Oficina"], ["Ninja", "Ninja"], ["Bookworm", "Ratón de biblioteca"]],
  };
  // [en, es] in Sheet 2 order (row-major 4 x 5); ids s01..s20
  const SECRET_NAMES = [
    ["Japan", "Japón"], ["France", "Francia"], ["Andes", "Andes"], ["Portugal", "Portugal"], ["Mexico", "México"],
    ["Italy", "Italia"], ["Germany", "Alemania"], ["USA", "Estados Unidos"], ["China", "China"], ["India", "India"],
    ["Thailand", "Tailandia"], ["UK", "Reino Unido"], ["Brazil", "Brasil"], ["Morocco", "Marruecos"], ["Russia", "Rusia"],
    ["Netherlands", "Países Bajos"], ["Spain", "España"], ["Greece", "Grecia"], ["Turkey", "Turquía"], ["Argentina", "Argentina"],
  ];
  const CHARACTERS = [];
  for (const col of COLLECTIONS) {
    COMMON_NAMES[col.id].forEach(([en, es], i) => {
      const row = i + 1;
      CHARACTERS.push({ id: col.id + "-" + row, col: col.id, tier: "common", img: "img/c/" + col.id + "-" + row + ".webp", en, es });
    });
  }
  SECRET_NAMES.forEach(([en, es], i) => {
    const n = String(i + 1).padStart(2, "0");
    CHARACTERS.push({ id: "s" + n, col: null, tier: "secret", img: "img/s/" + n + ".webp", en, es });
  });

  const byId = id => CHARACTERS.find(c => c.id === id);

  // ownedIds: array of character ids already owned. rng: () => [0, 1). Does not mutate ownedIds.
  const draw = (ownedIds, rng, opts) => {
    const noDup = !!(opts && opts.noDup);
    const owned = new Set(ownedIds);
    const pickFrom = list => list[Math.floor(rng() * list.length)];
    const pools = {};
    for (const tier of ["secret", "common"]) {
      const all = CHARACTERS.filter(c => c.tier === tier);
      pools[tier] = { owned: all.filter(c => owned.has(c.id)), fresh: all.filter(c => !owned.has(c.id)) };
    }
    let tier = rng() < SECRET_P ? "secret" : "common";
    if (!pools[tier].fresh.length) tier = tier === "secret" ? "common" : "secret";
    if (!pools[tier].fresh.length) {
      const everyOwned = CHARACTERS.filter(c => owned.has(c.id));
      return { id: pickFrom(everyOwned).id, dup: true };
    }
    const p = pools[tier];
    if (!noDup && p.owned.length && rng() < DUP_P) return { id: pickFrom(p.owned).id, dup: true };
    return { id: pickFrom(p.fresh).id, dup: false };
  };

  // Local-date helpers. Dates are "YYYY-MM-DD"; parsed as local time, never via new Date(string).
  const parseDay = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtDay = dt => dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  const addDays = (s, n) => { const dt = parseDay(s); dt.setDate(dt.getDate() + n); return fmtDay(dt); };
  const weekStart = s => addDays(s, -((parseDay(s).getDay() + 6) % 7)); // Monday

  const newShop = (today, lifetime) => ({ start: today, startPoints: lifetime, pulls: {} });

  // All pulls as a list sorted by time, ignoring any made at or before a collection reset.
  // Tolerates missing shop / pulls.
  const pulls = user => {
    const raw = (user.shop && user.shop.pulls) || {}, resetAt = (user.shop && user.shop.resetAt) || 0;
    return Object.keys(raw).filter(key => raw[key].at > resetAt).map(key => {
      const p = raw[key];
      const o = { key, c: p.c, at: p.at };
      if (p.free) o.free = true;
      if (p.dup) o.dup = true;
      return o;
    }).sort((x, y) => x.at - y.at);
  };

  // Unique character ids owned, in pull order.
  const owned = user => {
    const seen = new Set(), out = [];
    for (const p of pulls(user)) if (!seen.has(p.c)) { seen.add(p.c); out.push(p.c); }
    return out;
  };

  const freeAvailable = user => !!user.shop && !pulls(user).some(p => p.free);

  // Empties the collection and reopens the free box. Old openings stay stored (so a device that
  // still has them can't sync them back in) but are ignored from now on.
  const resetShop = (user, now) => { if (user.shop) user.shop.resetAt = now; };

  const addPull = (user, result, free, now, rand) => {
    if (!user.shop) throw new Error("addPull: user.shop is missing");
    if (!user.shop.pulls) user.shop.pulls = {};
    const key = now.toString(36) + rand().toString(36).slice(2, 8);
    const p = { c: result.id, at: now };
    if (free) p.free = true;
    if (result.dup) p.dup = true;
    user.shop.pulls[key] = p;
    return key;
  };

  // Weigh-in points: +10 per dated entry from start to today, max 3 per week; pace bonus +40 per qualifying week.
  // Pace is the week's mean vs the previous week's mean, in percent, inclusive ranges per goal.
  const PACE = { lean: [-1, -0.25], bulk: [0.1, 0.5] };
  const weightPoints = (user, today) => {
    if (!user.shop) return { total: 0, thisWeek: 0 };
    const start = user.shop.start, weights = user.weights || {};
    const days = Object.keys(weights).filter(d => { const kg = weights[d]; return typeof kg === "number" && isFinite(kg) && kg > 0; });
    const byWeek = {}, allByWeek = {};
    for (const d of days) { const w = weekStart(d); (allByWeek[w] = allByWeek[w] || []).push(d); }
    for (const d of days) if (d >= start && d <= today) { const w = weekStart(d); (byWeek[w] = byWeek[w] || []).push(d); }
    const thisMonday = weekStart(today);
    let total = 0, thisWeek = 0;
    for (const w of Object.keys(byWeek)) {
      const pts = Math.min(byWeek[w].length, 3) * 10;
      total += pts;
      if (w === thisMonday) thisWeek += pts;
    }
    const range = PACE[user.goal];
    if (range) {
      const mean = ds => ds.reduce((sum, d) => sum + weights[d], 0) / ds.length;
      for (const w of Object.keys(allByWeek)) {
        const prev = allByWeek[addDays(w, -7)];
        // W must start on/after the start's week, be complete, and have a previous-week entry. Means use every valid entry.
        if (w < weekStart(start) || addDays(w, 6) >= today || !prev) continue;
        const delta = Math.round((mean(allByWeek[w]) - mean(prev)) / mean(prev) * 100 * 10000) / 10000;
        if (delta >= range[0] && delta <= range[1]) total += 40;
      }
    }
    return { total, thisWeek };
  };

  const balance = (user, today, lifetime) => {
    const w = weightPoints(user, today).total;
    const startPoints = user.shop ? user.shop.startPoints : lifetime;
    const brain = Math.max(0, lifetime - startPoints);
    const paid = pulls(user).filter(p => !p.free);
    const spent = PRICE * paid.length - REFUND * paid.filter(p => p.dup).length;
    return { balance: Math.max(0, brain + w - spent), brain, weight: w, spent };
  };

  const progress = (user, col) => ({
    have: owned(user).filter(id => { const c = byId(id); return !!c && c.col === col; }).length,
    total: 6,
  });

  const secretsFound = user => owned(user).filter(id => { const c = byId(id); return !!c && c.tier === "secret"; });

  // Union of pulls by key; start/startPoints from the side with the earlier start
  // (tie -> larger startPoints, so the result does not depend on argument order); newest resetAt wins.
  const mergeShop = (a, b) => {
    if (!a && !b) return undefined;
    const withReset = (o, r) => { if (r) o.resetAt = r; return o; };
    if (!a || !b) { const s = a || b; return withReset({ start: s.start, startPoints: s.startPoints, pulls: Object.assign({}, s.pulls) }, s.resetAt); }
    const first = b.start < a.start ? b
      : (b.start === a.start && (b.startPoints || 0) > (a.startPoints || 0)) ? b : a;
    return withReset({ start: first.start, startPoints: first.startPoints, pulls: Object.assign({}, b.pulls, a.pulls) },
      Math.max(a.resetAt || 0, b.resetAt || 0));
  };

  return { PRICE, REFUND, SECRET_P, DUP_P, COLLECTIONS, CHARACTERS, byId, draw,
    newShop, pulls, owned, freeAvailable, resetShop, addPull, weightPoints, balance, progress, secretsFound, mergeShop };
})();
if (typeof module !== "undefined") module.exports = Shop; else window.Shop = Shop;
