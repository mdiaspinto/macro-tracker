// Brain games points (pure, no DOM). A wrong answer is always 0 points.
const Score = {
  // 0 under the minimum time (a tap that fast is a guess), 10 up to the low limit, straight line to 0 at the high limit.
  speedBonus(answerMs, twoQuestions) {
    if (typeof answerMs !== "number" || !isFinite(answerMs)) return 0;
    const min = twoQuestions ? 1000 : 500, lo = twoQuestions ? 2000 : 1000, hi = twoQuestions ? 10000 : 5000;
    if (answerMs < min) return 0;
    if (answerMs <= lo) return 10;
    if (answerMs >= hi) return 0;
    return Math.round(10 * (hi - answerMs) / (hi - lo));
  },
  peek({ ok, answerMs, level, step }) {
    if (!ok) return 0;
    const l = level || 1, s = step || 1;
    return Math.round((10 + Score.speedBonus(answerMs, l >= 2)) * (1 + 0.25 * (s - 1) + 0.25 * (l - 1)));
  },
  parade({ ok, span, reverse }) {
    return ok ? Math.round(10 * span * (reverse ? 1.5 : 1)) : 0;
  },
  names({ ok, choices }) {
    return ok ? (choices === 6 ? 15 : 10) : 0;
  },
  bestId: (game) => game,
  // Points per minute with a small bonus for longer games. 0 for bad input; len 4-5 only converts old records.
  rating(points, len) {
    if (typeof points !== "number" || !isFinite(points) || typeof len !== "number" || !(len >= 1 && len <= 5)) return 0;
    return Math.round(points / len * (1 + 0.1 * (len - 1)));
  },
  // Old records are "<game>_<len>"; new ones are "<game>". Each game gets the highest of the new-id record
  // and every converted old record (a tie keeps the new-id record). Returns a new object, never changes the input.
  migrateBest(best) {
    const ok = (r) => !!r && typeof r === "object" && typeof r.score === "number" && isFinite(r.score) && r.score >= 0;
    const src = best && typeof best === "object" ? best : {}, out = {};
    ["peek", "parade", "names"].forEach((g) => {
      for (let len = 1; len <= 5; len++) {
        const rec = src[g + "_" + len];
        if (!ok(rec)) continue;
        const score = Score.rating(rec.score, len);
        if (!out[g] || score >= out[g].score) out[g] = { score, points: rec.score, len, at: rec.at };
      }
      if (ok(src[g]) && (!out[g] || src[g].score >= out[g].score)) out[g] = src[g];
    });
    return out;
  },
  isBetter: (score, rec) => typeof score === "number" && isFinite(score) && (!rec || !(typeof rec.score === "number" && isFinite(rec.score)) || score > rec.score),
};
if (typeof module !== "undefined") module.exports = Score; else window.Score = Score;
