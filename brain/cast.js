// Brain games cast and art paths (relative to deploy/brain/).
const Cast = {
  MEMBERS: ["teo:Teo:blue", "flor:Flor:pink", "pepe:Pepe:green", "nico:Nico:dark", "beto:Beto:orange", "gael:Gael:brown", "dina:Dina:white", "rey:Rey:yellow", "hugo:Hugo:green", "sol:Sol:yellow", "estela:Estela:blue", "alma:Alma:red", "marco:Marco:blue", "inaki:Iñaki:brown", "vera:Vera:white", "oscar:Óscar:gray", "zoe:Zoe:green"].map(s => { const [id, name, group] = s.split(":"); return { id, name, group, img: `img/${id}.webp` }; }),
  TARGETS: ["balloon", "star", "gift"].map(id => ({ id, img: `img/${id}.webp` })),
  DISTRACTORS: ["cloud", "leaf", "butterfly"].map(id => ({ id, img: `img/${id}.webp` })),
  ART: { logo: "img/logo.webp", bg: "img/bg.webp", cheer: "img/cheer.webp", oops: "img/oops.webp" },
};
Cast.GROUPS = {}; Cast.MEMBERS.forEach(m => { Cast.GROUPS[m.id] = m.group; });
if (typeof module !== "undefined") module.exports = Cast; else window.Cast = Cast;
