// Brain games rating stats per day and game (pure, no DOM).
// stats = {"YYYY-MM-DD": {peek|parade|names: {n, sum, best}}}.
const Stats = (() => {
  const B = typeof require !== "undefined" ? require("../brain.js") : window.Brain;
  const S = typeof require !== "undefined" ? require("./session.js") : window.Session;
  const GAMES = ["peek", "parade", "names"];
  const num = (x) => (typeof x === "number" && isFinite(x) ? x : 0);
  return {
    // Returns a new stats object with one more rating. Bad input returns the same object.
    add(stats, date, game, rating) {
      if (typeof rating !== "number" || !isFinite(rating) || GAMES.indexOf(game) < 0 ||
        typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return stats;
      const src = stats || {}, out = Object.assign({}, src);
      const day = Object.assign({}, src[date]);
      const cur = day[game];
      day[game] = cur ? { n: num(cur.n) + 1, sum: num(cur.sum) + rating, best: Math.max(num(cur.best), rating) }
        : { n: 1, sum: rating, best: rating };
      out[date] = day;
      return out;
    },
    // Merge two entries of one day and game. A missing side counts as empty.
    merge(a, b) {
      const x = a || {}, y = b || {};
      return { n: num(x.n) + num(y.n), sum: num(x.sum) + num(y.sum), best: Math.max(num(x.best), num(y.best)) };
    },
    // The entry with the higher n (the later one of one day and game). A tie keeps `a`.
    newer(a, b) { return a && (!b || a.n > b.n) ? a : b; },
    // True when a pending entry must replace the loaded one: it has games and more than the loaded entry, or none is loaded.
    pendingWins(pending, loaded) {
      return !!pending && pending.n > 0 && (!loaded || pending.n > loaded.n);
    },
    // `weeks` entries, oldest first, ending with the week of `today` (Monday to Sunday).
    weekly(stats, game, today, weeks) {
      const out = [], st = stats || {};
      for (let i = weeks - 1; i >= 0; i--) {
        const start = S._addDays(B.weekStart(today), -7 * i);
        let n = 0, sum = 0;
        for (let k = 0; k < 7; k++) {
          const e = st[S._addDays(start, k)];
          if (e && e[game]) { n += num(e[game].n); sum += num(e[game].sum); }
        }
        out.push({ start, avg: n > 0 ? Math.round(sum / n) : null, n });
      }
      return out;
    },
    // Days from Monday to `today` with play time. Remote days may lack fields, so normalize first.
    daysPlayed(sessions, today) {
      const ss = sessions || {};
      let c = 0;
      for (let d = B.weekStart(today); d <= today; d = S._addDays(d, 1)) {
        if (ss[d] && S.total(S.mergeDay(S.newDay(), ss[d])) > 0) c++;
      }
      return c;
    },
  };
})();
if (typeof module !== "undefined") module.exports = Stats; else window.Stats = Stats;
