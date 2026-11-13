const Charts = (() => {
  const RANGES = ["7", "30", "90", "all"];
  const pad = n => (n < 10 ? "0" : "") + n;
  const parseDate = s => { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const fmtDate = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
  const dayDiff = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
  const BACK = { "7": 6, "30": 29, "90": 89 };

  const rangeStart = (today, range) => Object.prototype.hasOwnProperty.call(BACK, range) ? addDays(today, -BACK[range]) : null;

  function filterRange(points, range, today) {
    const start = rangeStart(today, range);
    return points.filter(p => (start === null || p.date >= start) && p.date <= today);
  }

  // One point per calendar day from first to last input date; needs >= minCount logged days in the trailing window.
  function rollingMean(points, window = 7, minCount = 3) {
    if (!points.length) return [];
    const out = [], last = points[points.length - 1].date;
    let lo = 0, hi = 0, sum = 0; // window is points[lo..hi)
    for (let day = points[0].date; day <= last; day = addDays(day, 1)) {
      const from = addDays(day, -(window - 1));
      while (hi < points.length && points[hi].date <= day) sum += points[hi++].value;
      while (lo < hi && points[lo].date < from) sum -= points[lo++].value;
      if (hi - lo >= minCount) out.push({ date: day, value: sum / (hi - lo) });
    }
    return out;
  }

  function dateTicks(from, to, maxTicks = 5) {
    const daily = dayDiff(from, to) <= 14, cand = [];
    for (let d = from; d <= to; d = addDays(d, 1)) if (daily || parseDate(d).getDay() === 1) cand.push(d);
    const step = Math.max(1, Math.ceil(cand.length / maxTicks)), out = [];
    for (let i = 0; i < cand.length; i += step) out.push(cand[i]);
    return out;
  }

  function onTarget(points, target, tol = 0.1) {
    return { hit: points.filter(p => Math.abs(p.value - target) <= tol * target).length, total: points.length };
  }

  return { RANGES, rangeStart, filterRange, rollingMean, dateTicks, onTarget };
})();
if (typeof module !== "undefined") module.exports = Charts; else window.Charts = Charts;
