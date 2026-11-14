// Peek-a-boo: speed-of-processing staircase (pure, no DOM).
const Peek = {
  init() { return { level: 1, ms: 500, okRun: 0, fastRun: 0 }; },
  frames(ms) { return Math.max(1, Math.round(ms / (1000 / 60))); },
  // Fisher-Yates on a copy
  _shuffle(a, rng) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  },
  // Speed meter value 1..5 (higher = faster)
  speedStep(ms) {
    if (typeof ms !== "number" || ms !== ms) return 1;
    return ms >= 500 ? 1 : ms >= 250 ? 2 : ms >= 120 ? 3 : ms >= 60 ? 4 : 5;
  },
  makeTrial(state, rng, castIds, groups) {
    const ids = Peek._shuffle(castIds, rng);
    const n = state.level >= 4 ? Math.min(4, ids.length) : Math.min(2, ids.length);
    const center = ids[0];
    let picked = ids.slice(0, n);
    if (groups && state.level < 4) {
      // other choices come from groups not used yet; fill from any rest
      const used = {}, rest = ids.slice(1);
      used[groups[center]] = true;
      picked = [center];
      for (let i = 0; i < rest.length && picked.length < n; i++) {
        if (!used[groups[rest[i]]]) { used[groups[rest[i]]] = true; picked.push(rest[i]); }
      }
      for (let i = 0; i < rest.length && picked.length < n; i++) if (picked.indexOf(rest[i]) < 0) picked.push(rest[i]);
    }
    const choices = Peek._shuffle(picked, rng);
    if (state.level < 2) return { center, choices, edge: null, distractors: [] };
    const edge = Math.floor(rng() * 8);
    const distractors = [];
    if (state.level >= 3) for (let p = 0; p < 8; p++) if (p !== edge) distractors.push(p);
    return { center, choices, edge, distractors };
  },
  grade(state, trial, answer) {
    const ok = answer.center === trial.center && (state.level < 2 || answer.edge === trial.edge);
    let ms = state.ms, okRun = state.okRun;
    if (ok) { okRun++; if (okRun >= 2) { ms *= 0.85; okRun = 0; } }
    else { ms *= 1.15; okRun = 0; }
    ms = Math.min(1000, Math.max(17, ms));
    const fastRun = state.ms < 100 ? state.fastRun + 1 : 0;
    if (fastRun >= 10 && state.level < 4) {
      return { state: { level: state.level + 1, ms: 500, okRun: 0, fastRun: 0 }, ok, levelUp: true };
    }
    return { state: { level: state.level, ms, okRun, fastRun }, ok, levelUp: false };
  },
};
if (typeof module !== "undefined") module.exports = Peek; else window.Peek = Peek;
