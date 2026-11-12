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

  return { PRICE, REFUND, SECRET_P, DUP_P, COLLECTIONS, CHARACTERS, byId, draw };
})();
if (typeof module !== "undefined") module.exports = Shop; else window.Shop = Shop;
