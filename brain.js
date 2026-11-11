// Brain-food detection (MIND diet) for meal names in EN/ES/FR. Pure functions, no DOM/network.
const Brain = (() => {
  const CATEGORIES = [
    { id: "greens", emoji: "🥬", target: 6, kind: "food" },
    { id: "veg", emoji: "🥦", target: 7, kind: "food" },
    { id: "berries", emoji: "🫐", target: 2, kind: "food" },
    { id: "nuts", emoji: "🥜", target: 5, kind: "food" },
    { id: "beans", emoji: "🫘", target: 3, kind: "food" },
    { id: "fish", emoji: "🐟", target: 2, kind: "food" },
    { id: "grains", emoji: "🌾", target: 21, kind: "food" },
    { id: "olive", emoji: "🫒", target: 7, kind: "food" },
    { id: "strength", emoji: "🏋️", target: 2, kind: "habit" },
    { id: "walk", emoji: "🚶", target: 5, kind: "habit" },
    { id: "sleep", emoji: "😴", target: 7, kind: "habit" },
    { id: "social", emoji: "👥", target: 3, kind: "habit" },
    { id: "mind", emoji: "🧩", target: 3, kind: "habit" },
  ];
  const LIMIT_TAGS = { sweets: 4, fried: 1, redMeat: 3, butter: 4, cheese: 3 };

  // Keywords are normalized (lowercase, no accents, ligatures expanded); plurals listed explicitly.
  const KEYWORDS = {
    greens: ["spinach", "kale", "lettuce", "arugula", "rocket", "chard", "swiss chard", "collard greens", "watercress", "salad greens", "mixed greens", "romaine", "bok choy",
      "espinaca", "espinacas", "lechuga", "rucula", "acelga", "acelgas", "berro", "berros", "canonigos", "col rizada",
      "epinard", "epinards", "laitue", "roquette", "blette", "blettes", "mache", "cresson", "salade verte", "jeunes pousses", "mesclun"],
    veg: ["broccoli", "carrot", "carrots", "cauliflower", "bell pepper", "bell peppers", "red pepper", "red peppers", "green pepper", "green peppers", "tomato", "tomatoes", "zucchini", "courgette", "eggplant", "aubergine", "cucumber", "onion", "onions", "asparagus", "beet", "beets", "cabbage", "celery", "leek", "leeks", "mushroom", "mushrooms", "green beans", "brussels sprouts", "artichoke", "pumpkin", "squash", "radish", "fennel",
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
    redMeat: ["beef", "steak", "steaks", "pork", "lamb", "veal", "burger", "burgers", "hamburger", "bacon", "sausage", "sausages", "ham", "salami", "chorizo", "meatball", "meatballs", "hot dog", "hot dogs", "ribs", "mutton", "venison", "ground beef", "mince",
      "ternera", "carne de res", "cerdo", "cordero", "hamburguesa", "hamburguesas", "salchicha", "salchichas", "jamon", "salchichon", "albondiga", "albondigas", "costillas", "costilla", "lomo", "chuleta", "chuletas", "carne picada",
      "boeuf", "bifteck", "biftecks", "steak hache", "steaks haches", "porc", "agneau", "veau", "lard", "lardons", "saucisse", "saucisses", "saucisson", "jambon", "boulette", "boulettes", "cotelette", "cotelettes", "viande hachee", "viande rouge", "merguez", "andouillette", "rosbif", "entrecote", "rumsteck"],
    butter: ["butter", "ghee", "margarine",
      "mantequilla", "manteca", "margarina",
      "beurre", "beurre doux", "beurre sale"],
    cheese: ["cheese", "cheddar", "mozzarella", "parmesan", "brie", "camembert", "gouda", "feta", "cream cheese", "goat cheese", "gruyere", "emmental", "ricotta", "mascarpone", "blue cheese", "halloumi", "cheeses",
      "queso", "quesos", "queso fresco", "manchego", "parmesano", "requeson", "queso crema",
      "fromage", "fromages", "chevre", "emmental", "comte", "roquefort", "raclette", "boursin", "fromage blanc", "reblochon", "mimolette"],
  };

  // Nut butters count as nuts, not butter: strip these phrases before checking the butter keywords.
  const NUT_BUTTERS = ["peanut butter", "almond butter", "cashew butter", "hazelnut butter", "nut butter", "crema de cacahuete", "crema de cacahuate", "crema de almendras", "mantequilla de cacahuete", "mantequilla de cacahuate", "mantequilla de mani", "mantequilla de almendras", "beurre de cacahuete", "beurre de cacahuetes", "beurre d amande", "beurre d amandes", "beurre de noisette", "beurre de noix de cajou"];

  // Plant milks are neither grains nor nuts: strip these phrases before every check.
  const PLANT_MILKS = ["oat milk", "almond milk", "cashew milk", "hazelnut milk", "leche de avena", "leche de almendras", "leche de almendra", "leche de anacardo", "leche de avellana", "lait d avoine", "lait d amande", "lait d amandes", "lait de noisette", "lait de cajou"];

  const normalize = s => String(s || "").replace(/œ/gi, "oe").replace(/æ/gi, "ae").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, " ");

  const pad = s => " " + s.replace(/[^a-z]+/g, " ").trim() + " ";
  const hit = (p, kw) => p.includes(" " + pad(kw).trim() + " ");

  function detectTags(name) {
    const strip = (str, phrases) => phrases.reduce((acc, ph) => acc.split(pad(ph).trimEnd()).join(" "), str);
    const p = strip(pad(normalize(name)), PLANT_MILKS);
    const noNutButter = strip(p, NUT_BUTTERS);
    const tags = Object.keys(KEYWORDS).filter(t => KEYWORDS[t].some(kw => hit(t === "butter" ? noNutButter : p, kw)));
    if (tags.includes("oilyFish") && !tags.includes("fish")) tags.push("fish");
    return tags;
  }

  return { CATEGORIES, LIMIT_TAGS, KEYWORDS, normalize, detectTags };
})();
if (typeof module !== "undefined") module.exports = Brain; else window.Brain = Brain;
