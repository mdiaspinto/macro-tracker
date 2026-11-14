// Toy parade: working-memory span staircase (pure, no DOM).
const Parade = {
  init() { return { span: 2, ms: 1800, okRun: 0, badRun: 0, count: 0 }; },
  gridSize(span) { return Math.min(6, span + 1); },
  // One-time migration of a saved v2 state: slower and one step shorter.
  // version is the marker progress.paradeV. With no marker the span is cut once. The caller then stores the marker (2).
  // An old tab can save parade without ms but keeps the marker; then only ms is set.
  upgrade(state, version) {
    if (state == null) return Parade.init();
    const cut = !(version >= 2), needMs = !Number.isFinite(state.ms);
    if (!cut && !needMs) return state;
    const out = { ...state };
    if (needMs) out.ms = 1800;
    if (cut) out.span = Math.max(2, (state.span || 2) - 1);
    return out;
  },
  // Fisher-Yates on a copy
  _shuffle(a, rng) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  },
  makeSequence(state, rng, castIds) {
    const n = state.span;
    const reverse = n >= 6 && state.count % 2 === 1;
    if (n <= castIds.length) return { seq: Parade._shuffle(castIds, rng).slice(0, n), reverse };
    // span above cast size: repeats allowed, never the same id twice in a row
    const seq = [];
    for (let i = 0; i < n; i++) {
      const pool = castIds.filter((id) => id !== seq[i - 1]);
      seq.push(pool[Math.floor(rng() * pool.length)]);
    }
    return { seq, reverse };
  },
  grade(state, round, answer) {
    const want = round.reverse ? round.seq.slice().reverse() : round.seq;
    const ok = answer.length === want.length && want.every((id, i) => id === answer[i]);
    let span = state.span, okRun = ok ? state.okRun + 1 : 0, badRun = ok ? 0 : state.badRun + 1;
    if (okRun >= 2) { span++; okRun = 0; badRun = 0; }
    else if (badRun >= 2) { span = Math.max(2, span - 1); okRun = 0; badRun = 0; }
    const ms0 = Number.isFinite(state.ms) ? state.ms : 1800;
    const ms = Math.round(Math.min(2000, Math.max(800, ok ? ms0 * 0.9 : ms0 * 1.15)));
    return { state: { span, ms, okRun, badRun, count: state.count + 1 }, ok };
  },
};
if (typeof module !== "undefined") module.exports = Parade; else window.Parade = Parade;
