// Toy parade: working-memory span staircase (pure, no DOM).
const Parade = {
  init() { return { span: 3, okRun: 0, badRun: 0, count: 0 }; },
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
    return { state: { span, okRun, badRun, count: state.count + 1 }, ok };
  },
};
if (typeof module !== "undefined") module.exports = Parade; else window.Parade = Parade;
