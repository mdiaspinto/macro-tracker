// Brain games shared leaderboard rows (pure, no DOM).
// rows = {"<uid>_<profileKey>": {name, score, at}} for one game.
const Board = (() => {
  const GAMES = ["peek", "parade", "names"];
  const fin = (x) => typeof x === "number" && isFinite(x);
  const hasAt = (r) => fin(r.at);
  return {
    GAMES,
    entryKey(uid, profileKey) { return uid + "_" + profileKey; },
    // Row to write for a best record. Returns null when best has no valid score.
    row(best, name, now) {
      if (!best || !fin(best.score)) return null;
      return { name: String(name == null ? "" : name).trim().slice(0, 40), score: best.score, at: fin(best.at) ? best.at : now };
    },
    // True when the remote row is missing, lower, or has another name.
    needsWrite(row, remote) {
      return !remote || !fin(remote.score) || remote.score < row.score || remote.name !== row.name;
    },
    // Sorted top rows. `me` is set only when myKey is outside the top.
    rank(rows, myKey, top) {
      const src = rows || {};
      const all = Object.keys(src).filter((k) => src[k] && fin(src[k].score)).map((k) => ({ key: k, name: src[k].name, score: src[k].score, at: src[k].at }));
      all.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (hasAt(a) !== hasAt(b)) return hasAt(a) ? -1 : 1;
        return hasAt(a) ? a.at - b.at : 0;
      });
      const out = all.map((r, i) => ({ key: r.key, name: r.name, score: r.score, rank: i + 1 }));
      const shown = out.slice(0, top).map((r) => Object.assign({}, r, { me: r.key === myKey }));
      const mine = out.slice(top).filter((r) => r.key === myKey)[0];
      return { top: shown, me: mine || null };
    },
    // Keys of this account whose profile key is no longer in profileKeys.
    staleKeys(rows, uid, profileKeys) {
      const prefix = uid + "_", keep = profileKeys || [];
      return Object.keys(rows || {}).filter((k) => k.indexOf(prefix) === 0 && keep.indexOf(k.slice(prefix.length)) < 0);
    },
  };
})();
if (typeof module !== "undefined") module.exports = Board; else window.Board = Board;
