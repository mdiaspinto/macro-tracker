// Brain-food detection (MIND diet) for meal names in EN/ES/FR. Pure functions, no DOM/network.
const Brain = (() => {
  const CATEGORIES = [
    { id: "greens", icon: "salad", target: 6, kind: "food" },
    { id: "veg", icon: "carrot", target: 7, kind: "food" },
    { id: "berries", icon: "cherry", target: 2, kind: "food" },
    { id: "nuts", icon: "nut", target: 5, kind: "food" },
    { id: "beans", icon: "bean", target: 3, kind: "food" },
    { id: "fish", icon: "fish", target: 2, kind: "food" },
    { id: "grains", icon: "wheat", target: 21, kind: "food" },
    { id: "olive", icon: "droplet", target: 7, kind: "food" },
    { id: "strength", icon: "dumbbell", target: 2, kind: "habit" },
    { id: "walk", icon: "footprints", target: 5, kind: "habit" },
    { id: "sleep", icon: "moon", target: 7, kind: "habit" },
    { id: "social", icon: "users", target: 3, kind: "habit" },
    { id: "mind", icon: "puzzle", target: 3, kind: "habit" },
  ];
  const LIMIT_TAGS = { sweets: 4, fried: 1, redMeat: 3, butter: 4, cheese: 3 };

  // Keywords are normalized (lowercase, no accents, ligatures expanded); plurals listed explicitly.
  const KEYWORDS = {
    greens: ["spinach", "kale", "lettuce", "arugula", "rocket", "chard", "swiss chard", "collard greens", "watercress", "salad greens", "mixed greens", "romaine", "bok choy", "salad", "salads",
      "espinaca", "espinacas", "lechuga", "rucula", "acelga", "acelgas", "berro", "berros", "canonigos", "col rizada", "ensalada", "ensaladas",
      "epinard", "epinards", "laitue", "roquette", "blette", "blettes", "mache", "cresson", "salade verte", "jeunes pousses", "mesclun", "salade", "salades"],
    veg: ["broccoli", "carrot", "carrots", "cauliflower", "peppers", "bell pepper", "bell peppers", "red pepper", "red peppers", "green pepper", "green peppers", "tomato", "tomatoes", "zucchini", "courgette", "eggplant", "aubergine", "cucumber", "onion", "onions", "asparagus", "beet", "beets", "cabbage", "celery", "leek", "leeks", "mushroom", "mushrooms", "green beans", "brussels sprouts", "artichoke", "pumpkin", "squash", "radish", "fennel",
      "brocoli", "zanahoria", "zanahorias", "coliflor", "pimiento", "pimientos", "tomate", "tomates", "calabacin", "berenjena", "berenjenas", "pepino", "cebolla", "cebollas", "esparrago", "esparragos", "remolacha", "col", "repollo", "apio", "puerro", "puerros", "champinon", "champinones", "setas", "judias verdes", "alcachofa", "alcachofas", "calabaza",
      "carotte", "carottes", "chou", "chou fleur", "chou-fleur", "poivron", "poivrons", "tomates", "courgettes", "aubergines", "concombre", "oignon", "oignons", "asperge", "asperges", "betterave", "celeri", "poireau", "poireaux", "champignon", "champignons", "haricots verts", "artichaut", "citrouille", "courge", "radis", "fenouil", "legumes", "verduras", "vegetables", "veggies", "ratatouille"],
    berries: ["blueberry", "blueberries", "strawberry", "strawberries", "raspberry", "raspberries", "blackberry", "blackberries", "cranberry", "cranberries", "berries", "acai", "goji",
      "arandano", "arandanos", "fresa", "fresas", "frambuesa", "frambuesas", "mora", "moras", "grosella", "grosellas", "frutos rojos", "frutas del bosque",
      "myrtille", "myrtilles", "fraise", "fraises", "framboise", "framboises", "cassis", "groseille", "groseilles", "canneberge", "canneberges", "fruits rouges", "fruits des bois", "baies"],
    nuts: ["nut", "nuts", "almond", "almonds", "walnut", "walnuts", "cashew", "cashews", "pistachio", "pistachios", "hazelnut", "hazelnuts", "pecan", "pecans", "peanut", "peanuts", "brazil nuts", "macadamia", "pine nuts", "mixed nuts", "tahini",
      "nuez", "nueces", "almendra", "almendras", "anacardo", "anacardos", "pistacho", "pistachos", "avellana", "avellanas", "cacahuete", "cacahuetes", "cacahuate", "cacahuates", "mani", "pinones", "frutos secos",
      "noix", "amande", "amandes", "noix de cajou", "pistaches", "noisette", "noisettes", "noix de pecan", "arachide", "arachides", "cacahuete", "pignons", "fruits secs", "fruits a coque"],
    beans: ["beans", "bean", "lentil", "lentils", "chickpea", "chickpeas", "hummus", "black beans", "kidney beans", "edamame", "peas", "split peas", "lupini", "tofu", "dal", "dhal",
      "frijol", "frijoles", "judia", "judias", "alubia", "alubias", "lenteja", "lentejas", "garbanzo", "garbanzos", "hummus", "guisantes", "habas", "soja", "tofu",
      "haricots", "haricots rouges", "haricots blancs", "lentille", "lentilles", "pois chiches", "petits pois", "feves", "houmous", "falafel", "flageolets", "soja"],
    fish: ["fish", "tuna", "cod", "hake", "sea bass", "seabass", "bream", "haddock", "tilapia", "sole", "halibut", "swordfish", "shrimp", "prawns", "prawn", "seafood", "squid", "octopus", "mussels", "clams", "oysters", "scallops", "crab", "lobster", "calamari", "pollock", "monkfish", "sushi",
      "pescado", "atun", "bacalao", "merluza", "lubina", "dorada", "pez espada", "gamba", "gambas", "camaron", "camarones", "marisco", "mariscos", "calamar", "calamares", "pulpo", "mejillones", "almejas", "ostras", "vieiras", "cangrejo", "langosta", "lenguado", "pescadilla",
      "poisson", "poissons", "thon", "cabillaud", "morue", "colin", "dorade", "sole", "crevette", "crevettes", "gambas", "fruits de mer", "calmar", "poulpe", "moules", "palourdes", "huitres", "saint jacques", "coquilles saint jacques", "crabe", "homard", "lotte", "merlu", "surimi"],
    oilyFish: ["salmon", "sardine", "sardines", "mackerel", "herring", "trout", "anchovy", "anchovies",
      "salmon", "sardina", "sardinas", "caballa", "arenque", "trucha", "anchoa", "anchoas", "boqueron", "boquerones", "jurel", "bonito del norte",
      "saumon", "saumons", "maquereau", "maquereaux", "hareng", "harengs", "truite", "truites", "anchois"],
    grains: ["oats", "oatmeal", "porridge", "quinoa", "brown rice", "whole wheat", "wholemeal", "whole grain", "wholegrain", "whole grains", "multigrain", "barley", "buckwheat", "bulgur", "farro", "millet", "rye", "wild rice", "granola", "muesli", "whole wheat bread", "whole wheat pasta",
      "avena", "arroz integral", "pan integral", "pasta integral", "cebada", "trigo sarraceno", "centeno", "mijo", "espelta",
      "flocons d avoine", "flocons d'avoine", "avoine", "riz complet", "pain complet", "pates completes", "farine complete", "sarrasin", "orge", "seigle", "boulgour", "epeautre", "millet", "riz sauvage", "pain aux cereales", "pain de seigle"],
    olive: ["olive oil", "extra virgin olive oil", "evoo",
      "aceite de oliva", "aceite oliva", "aove",
      "huile d olive", "huile d'olive", "huile olive"],
    sweets: ["cake", "cakes", "cookie", "cookies", "candy", "chocolate", "ice cream", "donut", "donuts", "doughnut", "brownie", "pastry", "pastries", "croissant", "croissants", "muffin", "muffins", "biscuit", "biscuits", "sweets", "dessert", "apple pie", "pumpkin pie", "pecan pie", "cherry pie", "waffle", "waffles", "pancake", "pancakes", "soda", "sugar", "candies", "cupcake", "pain au chocolat", "danish",
      "pastel", "pasteles", "galleta", "galletas", "caramelo", "caramelos", "helado", "helados", "dulce", "dulces", "tarta", "tartas", "bollo", "bollos", "magdalena", "magdalenas", "donut", "refresco", "azucar", "postre", "flan", "churro", "churros", "napolitana",
      "gateau", "gateaux", "biscuits", "bonbon", "bonbons", "glace", "glaces", "creme glacee", "beignet", "beignets", "viennoiserie", "viennoiseries", "pain au chocolat", "pains au chocolat", "tarte", "tartes", "eclair", "eclairs", "macaron", "macarons", "sucre", "dessert", "gaufre", "gaufres", "crepe", "crepes", "mousse au chocolat", "chocolat"],
    fried: ["fried", "fries", "french fries", "chips", "deep fried", "fried chicken", "nuggets", "tempura", "fritter", "fritters", "crisps", "fish and chips",
      "frito", "frita", "fritos", "fritas", "patatas fritas", "papas fritas", "croquetas", "croqueta", "empanado", "empanados", "rebozado", "rebozados", "calamares a la romana", "fritura",
      "frit", "frite", "frits", "frites", "pommes frites", "friture", "croquette", "croquettes", "panure", "pane", "beignets", "chips"],
    redMeat: ["beef", "steak", "steaks", "pork", "lamb", "veal", "burger", "burgers", "hamburger", "bacon", "sausage", "sausages", "ham", "salami", "chorizo", "meatball", "meatballs", "hot dog", "hot dogs", "cheeseburger", "cheeseburgers", "ribs", "mutton", "venison", "ground beef", "mince",
      "ternera", "carne de res", "cerdo", "cordero", "hamburguesa", "hamburguesas", "salchicha", "salchichas", "jamon", "salchichon", "albondiga", "albondigas", "costillas", "costilla", "lomo", "chuleta", "chuletas", "carne picada",
      "boeuf", "bifteck", "biftecks", "steak hache", "steaks haches", "porc", "agneau", "veau", "lard", "lardons", "saucisse", "saucisses", "saucisson", "jambon", "boulette", "boulettes", "cotelette", "cotelettes", "viande hachee", "viande rouge", "merguez", "andouillette", "rosbif", "entrecote", "rumsteck"],
    butter: ["butter", "ghee", "margarine",
      "mantequilla", "manteca", "margarina",
      "beurre", "beurre doux", "beurre sale"],
    cheese: ["cheese", "cheddar", "mozzarella", "parmesan", "brie", "camembert", "gouda", "feta", "cream cheese", "goat cheese", "gruyere", "emmental", "ricotta", "mascarpone", "blue cheese", "halloumi", "cheeses", "cheeseburger", "cheeseburgers",
      "queso", "quesos", "queso fresco", "manchego", "parmesano", "requeson", "queso crema",
      "fromage", "fromages", "chevre", "emmental", "comte", "roquefort", "raclette", "boursin", "fromage blanc", "reblochon", "mimolette"],
  };

  // Nut butters count as nuts, not butter: strip these phrases before checking the butter keywords.
  const NUT_BUTTERS = ["peanut butter", "almond butter", "cashew butter", "hazelnut butter", "nut butter", "crema de cacahuete", "crema de cacahuate", "crema de almendras", "mantequilla de cacahuete", "mantequilla de cacahuate", "mantequilla de mani", "mantequilla de almendras", "beurre de cacahuete", "beurre de cacahuetes", "beurre d amande", "beurre d amandes", "beurre de noisette", "beurre de noix de cajou"];

  // Plant milks are neither grains nor nuts: strip these phrases before every check.
  const PLANT_MILKS = ["soy milk", "soya milk", "leche de soja", "lait de soja", "oat milk", "almond milk", "cashew milk", "hazelnut milk", "leche de avena", "leche de almendras", "leche de almendra", "leche de anacardo", "leche de avellana", "lait d avoine", "lait d amande", "lait d amandes", "lait de noisette", "lait de cajou"];

  const normalize = s => String(s || "").replace(/œ/gi, "oe").replace(/æ/gi, "ae").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, " ");

  // Negated sugar is not sweets: strip these phrases before every check.
  const NO_SUGAR = ["sin azucar", "sugar free", "no sugar", "no added sugar", "sans sucre", "zero sugar"];

  const pad = s => " " + s.replace(/[^a-z]+/g, " ").trim() + " ";
  const lead = ph => pad(ph).trimEnd();
  const PADDED = {};
  Object.keys(KEYWORDS).forEach(t => PADDED[t] = KEYWORDS[t].map(pad));
  const STRIP = [PLANT_MILKS, NO_SUGAR].map(l => l.map(lead)), STRIP_NB = NUT_BUTTERS.map(lead);
  const strip = (str, phrases) => phrases.reduce((acc, ph) => acc.split(ph).join(" "), str);

  function detectTags(name) {
    const p = strip(pad(normalize(name)), STRIP[0].concat(STRIP[1]));
    const noNutButter = strip(p, STRIP_NB);
    const tags = Object.keys(PADDED).filter(t => PADDED[t].some(kw => (t === "butter" ? noNutButter : p).includes(kw)));
    if (tags.includes("oilyFish") && !tags.includes("fish")) tags.push("fish");
    return tags;
  }

  // Detection is the hot path of every render for untagged legacy meals: memoize by raw name.
  const cache = new Map();
  function detectCached(name) {
    const k = String(name || "");
    let r = cache.get(k);
    if (!r) { if (cache.size > 5000) cache.clear(); cache.set(k, r = detectTags(k)); }
    return r.slice();
  }

  const mealTags = meal => Array.isArray(meal.brain) ? meal.brain : meal.brainManual ? [] : detectCached(meal.name);

  // Local-date helpers: "YYYY-MM-DD" <-> Date via local getters (never UTC).
  const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtDate = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
  const weekStart = date => addDays(date, -((parseDate(date).getDay() + 6) % 7));

  function weekScore(user, date) {
    const start = weekStart(date), days = (user && user.days) || {}, habits = (user && user.habits) || {};
    const counts = {}, limitCounts = {}, fill = {};
    CATEGORIES.forEach(c => counts[c.id] = 0);
    Object.keys(LIMIT_TAGS).forEach(t => limitCounts[t] = 0);
    let oily = 0, meals = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      (Array.isArray(days[d]) ? days[d] : []).filter(ml => ml && ml.eaten === true).forEach(ml => {
        meals++;
        const tags = mealTags(ml);
        CATEGORIES.forEach(c => { if (c.kind === "food" && tags.includes(c.id)) counts[c.id]++; });
        Object.keys(LIMIT_TAGS).forEach(t => { if (tags.includes(t)) limitCounts[t]++; });
        if (tags.includes("oilyFish")) oily++;
      });
      const h = habits[d] || {};
      CATEGORIES.forEach(c => { if (c.kind === "habit" && h[c.id] === true) counts[c.id]++; });
    }
    let sum = 0;
    CATEGORIES.forEach(c => { fill[c.id] = Math.min(1, counts[c.id] / c.target); sum += fill[c.id]; });
    const full = CATEGORIES.every(c => fill[c.id] >= 1);
    const clean = meals >= 7 && Object.keys(LIMIT_TAGS).every(t => limitCounts[t] <= LIMIT_TAGS[t]);
    const points = Math.round(30 * sum) + 5 * Math.min(oily, 2) + (full ? 50 : 0) + (clean ? 30 : 0);
    let nextHint = null;
    CATEGORIES.forEach(c => {
      const remaining = c.target - counts[c.id];
      if (remaining > 0 && (!nextHint || remaining < nextHint.remaining)) nextHint = { id: c.id, remaining };
    });
    return { start, bar: sum / CATEGORIES.length, fill, counts, limitCounts, oily, meals, clean, full, points, nextHint };
  }

  function lifetimePoints(user, today) {
    const days = (user && user.days) || {}, habits = (user && user.habits) || {};
    const keys = Object.keys(days).filter(d => Array.isArray(days[d]) && days[d].some(ml => ml && ml.eaten === true))
      .concat(Object.keys(habits).filter(d => Object.values(habits[d] || {}).includes(true)));
    if (!keys.length) return 0;
    let total = 0;
    for (let w = weekStart(keys.sort()[0]), last = weekStart(today); w <= last; w = addDays(w, 7)) total += weekScore(user, w).points;
    return total;
  }

  const LEVELS = [
    { id: "sprout", icon: "sprout", min: 0 }, { id: "growing", icon: "leaf", min: 500 }, { id: "sharp", icon: "lightbulb", min: 1500 },
    { id: "brilliant", icon: "sparkles", min: 3500 }, { id: "genius", icon: "brain", min: 7000 }, { id: "legend", icon: "trophy", min: 12000 },
  ];
  function levelFor(points) {
    let i = LEVELS.length - 1;
    while (i > 0 && points < LEVELS[i].min) i--;
    const next = LEVELS[i + 1] || null;
    return { level: LEVELS[i], next, toNext: next ? next.min - points : 0 };
  }

  // Optional per-key timestamps (habitsAt[date][id] = ms): the newer side wins, ties/missing go to primary.
  function unionHabits(primary, secondary, primaryAt, secondaryAt) {
    const out = {}, P = primary || {}, S = secondary || {}, PA = primaryAt || {}, SA = secondaryAt || {};
    new Set(Object.keys(S).concat(Object.keys(P))).forEach(d => {
      out[d] = Object.assign({}, S[d], P[d]);
      Object.keys((S[d] || {})).forEach(k => {
        if (P[d] && k in P[d] && ((SA[d] || {})[k] || 0) > ((PA[d] || {})[k] || 0)) out[d][k] = S[d][k];
      });
    });
    return out;
  }
  function unionHabitsAt(primaryAt, secondaryAt) {
    const out = {}, P = primaryAt || {}, S = secondaryAt || {};
    new Set(Object.keys(S).concat(Object.keys(P))).forEach(d => {
      out[d] = Object.assign({}, S[d], P[d]);
      Object.keys(S[d] || {}).forEach(k => { out[d][k] = Math.max(S[d][k] || 0, (P[d] || {})[k] || 0); });
    });
    return out;
  }
  const profileKey = name => String(name || "").trim().toLowerCase().replace(/[.$#\[\]\/]/g, "_");
  // Tick "mind" for completed brain-game sessions in last week..today, unless a newer manual change exists. Returns count ticked.
  function applyGameSessions(user, profileData, today) {
    const sessions = (profileData && profileData.sessions) || {}, from = addDays(weekStart(today), -7);
    let n = 0;
    Object.keys(sessions).forEach(d => {
      const at = sessions[d] && sessions[d].completedAt;
      if (!at || d < from || d > today) return;
      const have = ((user.habitsAt || {})[d] || {}).mind;
      if (have != null && have >= at) return;
      user.habits = user.habits || {}; user.habitsAt = user.habitsAt || {};
      user.habits[d] = Object.assign({}, user.habits[d], { mind: true });
      user.habitsAt[d] = Object.assign({}, user.habitsAt[d], { mind: at });
      n++;
    });
    return n;
  }
  function retagOnRename(meal, newName) { return meal.brainManual ? (meal.brain || []) : detectTags(newName); }

  return { CATEGORIES, LIMIT_TAGS, KEYWORDS, normalize, detectTags, mealTags, weekStart, weekScore, lifetimePoints, LEVELS, levelFor, unionHabits, unionHabitsAt, retagOnRename, profileKey, applyGameSessions };
})();
if (typeof module !== "undefined") module.exports = Brain; else window.Brain = Brain;
