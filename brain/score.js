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
  bestId: (game, len) => game + "_" + len,
  isBetter: (score, rec) => typeof score === "number" && isFinite(score) && (!rec || !(typeof rec.score === "number" && isFinite(rec.score)) || score > rec.score),
};
if (typeof module !== "undefined") module.exports = Score; else window.Score = Score;
