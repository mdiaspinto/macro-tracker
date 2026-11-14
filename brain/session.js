// Daily session: time per mode, completion, week count and streak (pure, no DOM).
// day = {modes: {peek, parade, names} (whole seconds), minutes, completedAt, _ms: per-mode ms}.
const Session = (() => {
  const B = typeof require !== "undefined" ? require("../brain.js") : window.Brain;
  const MODES = ["peek", "parade", "names"];
  return {
    PEEK_GOAL_S: 600,
    PARADE_S: 180,
    NAMES_MAX_S: 180,
    MAX_DELTA_MS: 2000,
    WEEK_TARGET: 3,
    newDay: () => ({
      modes: { peek: 0, parade: 0, names: 0 }, minutes: 0, completedAt: null,
      _ms: { peek: 0, parade: 0, names: 0 },
    }),
    _addDays(s, n) {
      const p = s.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
      d.setDate(d.getDate() + n);
      const pad = (x) => (x < 10 ? "0" : "") + x;
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    },
    // Rebuild modes and minutes from _ms; returns a new day.
    _fromMs(ms, completedAt) {
      const modes = {};
      MODES.forEach((m) => { modes[m] = Math.floor(ms[m] / 1000); });
      return {
        modes, minutes: Math.round((modes.peek + modes.parade + modes.names) / 60),
        completedAt, _ms: ms,
      };
    },
    _msOf: (day, m) => (day._ms && typeof day._ms[m] === "number" ? day._ms[m] : day.modes[m] * 1000),
    addTime(day, mode, deltaMs, now) {
      if (MODES.indexOf(mode) < 0) return day;
      const add = deltaMs > 0 && deltaMs <= Session.MAX_DELTA_MS ? deltaMs : 0;
      const ms = {};
      MODES.forEach((m) => { ms[m] = Session._msOf(day, m) + (m === mode ? add : 0); });
      const next = Session._fromMs(ms, day.completedAt);
      if (next.completedAt == null && next.modes.peek >= Session.PEEK_GOAL_S) next.completedAt = now;
      return next;
    },
    nextPart(day, namesAvailable, namesDue) {
      if (day.modes.peek < Session.PEEK_GOAL_S) return "peek";
      if (day.modes.parade < Session.PARADE_S) return "parade";
      if (namesAvailable && namesDue > 0 && day.modes.names < Session.NAMES_MAX_S) return "names";
      return "done";
    },
    // Completed days from start to end, both inclusive.
    _countRange(days, start, end) {
      let n = 0;
      for (let d = start; d <= end; d = Session._addDays(d, 1)) {
        if (days[d] && days[d].completedAt != null) n++;
      }
      return n;
    },
    weekCount: (days, today) => Session._countRange(days, B.weekStart(today), today),
    weekStreak(days, today) {
      let w = B.weekStart(today), n = 0;
      if (Session.weekCount(days, today) < Session.WEEK_TARGET) w = Session._addDays(w, -7);
      while (Session._countRange(days, w, Session._addDays(w, 6)) >= Session.WEEK_TARGET) {
        n++;
        w = Session._addDays(w, -7);
      }
      return n;
    },
    mergeDay(a, b) {
      const ms = {};
      MODES.forEach((m) => { ms[m] = Math.max(Session._msOf(a, m), Session._msOf(b, m)); });
      const times = [a.completedAt, b.completedAt].filter((t) => t != null);
      return Session._fromMs(ms, times.length ? Math.min.apply(null, times) : null);
    },
  };
})();
if (typeof module !== "undefined") module.exports = Session; else window.Session = Session;
