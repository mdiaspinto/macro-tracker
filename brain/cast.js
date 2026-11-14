// Brain games cast and art paths (relative to deploy/brain/).
const Cast = {
  MEMBERS: ["coco:Coco", "teo:Teo", "rosa:Rosa", "luna:Luna"].map(s => { const [id, name] = s.split(":"); return { id, name, img: `img/${id}.webp` }; }),
  TARGETS: ["balloon", "star", "gift"].map(id => ({ id, img: `img/${id}.webp` })),
  DISTRACTORS: ["cloud", "leaf", "butterfly"].map(id => ({ id, img: `img/${id}.webp` })),
  ART: { logo: "img/logo.webp", bg: "img/bg.webp", cheer: "img/cheer.webp", oops: "img/oops.webp" },
};
if (typeof module !== "undefined") module.exports = Cast; else window.Cast = Cast;
