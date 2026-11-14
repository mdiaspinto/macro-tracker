// Name that friend: spaced retrieval with Leitner boxes (pure, no DOM).
// cards[id] = {box: 1..5, due: "YYYY-MM-DD"}; keys starting with "_" are metadata.
const Names = {
  MIN_CAST: 12,
  GAPS: [1, 3, 7, 14, 30],
  available(castIds) { return castIds.length >= Names.MIN_CAST; },
  _pad: (n) => (n < 10 ? "0" : "") + n,
  _addDays(s, n) {
    const p = s.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + Names._pad(d.getMonth() + 1) + "-" + Names._pad(d.getDate());
  },
  // Fisher-Yates on a copy
  _shuffle(a, rng) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  },
  _has: (cards, id) => id.charAt(0) !== "_" && Object.prototype.hasOwnProperty.call(cards, id),
  plan(cards, castIds, today) {
    const ids = castIds.filter((id) => id.charAt(0) !== "_");
    const review = ids.filter((id) => Names._has(cards, id) && cards[id].due <= today)
      .map((id, i) => ({ id, i }))
      .sort((a, b) => (cards[a.id].due < cards[b.id].due ? -1 : cards[a.id].due > cards[b.id].due ? 1 : a.i - b.i))
      .map((x) => x.id);
    const intro = cards._introDay === today ? [] : ids.filter((id) => !Names._has(cards, id)).slice(0, 2);
    return { review, intro };
  },
  choices(id, castIds, rng) {
    if (castIds.length < 4) return Names._shuffle(castIds, rng);
    const others = Names._shuffle(castIds.filter((x) => x !== id), rng).slice(0, 3);
    return Names._shuffle(others.concat(id), rng);
  },
  grade(cards, id, ok, today) {
    const out = Object.assign({}, cards);
    const isNew = !Names._has(cards, id);
    let box = 1, due = today;
    if (ok) {
      box = isNew ? 1 : Math.min(cards[id].box + 1, 5);
      due = Names._addDays(today, Names.GAPS[box - 1]);
    }
    out[id] = { box, due };
    if (isNew) out._introDay = today;
    return out;
  },
};
if (typeof module !== "undefined") module.exports = Names; else window.Names = Names;
