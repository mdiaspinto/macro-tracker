// Spotlight tour: dims the page, cuts out one real element at a time and shows a small dialog beside it.
// DOM-only and app-agnostic: the app passes translated steps, button labels and callbacks.
// Nothing touches `document` until start(), so node can require this file to test place().
const Tour = (() => {
  const PAD = 8, GAP = 12, GUTTER = 16;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

  // Where the bubble goes, in viewport px. `rect` is the (padded) spotlight or null for a centred card.
  // Below the target if it fits, else above, else beside it, else pinned to the roomier edge ("over"); always GUTTER px inside the viewport.
  function place(rect, size, vp) {
    const maxLeft = vp.w - GUTTER - size.w, maxTop = vp.h - GUTTER - size.h;
    if (!rect) return { top: clamp((vp.h - size.h) / 2, GUTTER, maxTop), left: clamp((vp.w - size.w) / 2, GUTTER, maxLeft), side: "center" };
    const left = clamp(rect.left + rect.width / 2 - size.w / 2, GUTTER, maxLeft);
    const below = rect.top + rect.height + GAP, above = rect.top - GAP - size.h;
    if (below <= maxTop) return { top: Math.max(below, GUTTER), left, side: "below" };
    if (above >= GUTTER) return { top: Math.min(above, maxTop), left, side: "above" };
    // Tall target with free space beside it (e.g. a sticky side column on a wide screen): next to it, level with its middle.
    const mid = clamp(rect.top + rect.height / 2 - size.h / 2, GUTTER, maxTop);
    if (rect.left + rect.width + GAP + size.w <= vp.w - GUTTER) return { top: mid, left: rect.left + rect.width + GAP, side: "right" };
    if (rect.left - GAP - size.w >= GUTTER) return { top: mid, left: rect.left - GAP - size.w, side: "left" };
    const roomBelow = vp.h - rect.top - rect.height, roomAbove = rect.top;
    return { top: roomBelow >= roomAbove ? Math.max(maxTop, GUTTER) : GUTTER, left, side: "over" };
  }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let st = null, raf = 0, ro = null;
  const report = e => setTimeout(() => { throw e; }); // surface an app error without breaking the tour or its caller

  // A step's target is a selector, a function returning an element, or a list of those (largest first: the first one that
  // fits on screen beside the bubble wins, else the last). Missing or unrendered ones are skipped; none left -> centred card.
  function resolve(t) {
    let el = null;
    try { el = typeof t === "function" ? t() : t ? document.querySelector(t) : null; } catch (e) { el = null; }
    if (!el || !el.getClientRects().length) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? el : null;
  }
  function candidates() {
    const t = st.steps[st.i].target, list = Array.isArray(t) ? t : [t], out = [];
    list.forEach(c => { const el = resolve(c); if (el) out.push(el); });
    return out;
  }
  function padded(el) {
    const r = el.getBoundingClientRect();
    return { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD };
  }
  function layout(animate, scroll) {
    if (!st) return;
    const de = document.documentElement, vp = { w: de.clientWidth, h: de.clientHeight };
    const size = { w: st.bubble.offsetWidth, h: st.bubble.offsetHeight };
    const top = Math.max(GUTTER, st.opts.inset ? st.opts.inset() : 0), room = vp.h - GUTTER - top;
    const pairOf = el => el.getBoundingClientRect().height + 2 * PAD + GAP + size.h;
    const cands = candidates();
    if (scroll) { // entering a step: pick the target once, so a resize does not flip between candidates
      st.pick = 0;
      while (st.pick < cands.length - 1 && pairOf(cands[st.pick]) > room) st.pick++;
    }
    const el = cands[Math.min(st.pick, cands.length - 1)] || null;
    if (el && scroll) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" }); // brings it out of any inner scroller first
      // Then centre the target + bubble pair in the space below any sticky header; a pair too tall starts at that space's top.
      const r = padded(el), pair = pairOf(el);
      window.scrollBy(0, r.top - (pair <= room ? top + (room - pair) / 2 : top));
    }
    const rect = el ? padded(el) : null, p = place(rect, size, vp);
    const key = JSON.stringify([rect, p]);
    if (key === st.key) return; // e.g. the scroll event our own scrollIntoView fires
    st.key = key;
    const r = rect || { top: vp.h / 2, left: vp.w / 2, width: 0, height: 0 }, sp = st.spot.style;
    sp.transition = animate ? "" : "none";
    sp.top = r.top + "px"; sp.left = r.left + "px"; sp.width = r.width + "px"; sp.height = r.height + "px";
    st.spot.classList.toggle("tour-none", !rect);
    st.bubble.style.top = p.top + "px"; st.bubble.style.left = p.left + "px";
    st.bubble.setAttribute("data-side", p.side);
  }
  function onMove() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; layout(false, false); });
  }

  function go(i) {
    const s = st.steps[i], o = st.opts, L = o.labels || {}, n = st.steps.length, last = i === n - 1;
    st.i = i; st.key = "";
    if (s.tab && o.switchTab) { try { o.switchTab(s.tab); } catch (e) { report(e); } } // its target then just falls back
    const b = st.bubble, q = c => b.querySelector(c);
    q(".tour-media").innerHTML = s.media || "";
    q(".tour-media").hidden = !s.media;
    // The text sits in a live region that stays in place, so screen readers read each new step, not just "Next, button".
    q(".tour-count").textContent = L.count ? L.count(i + 1, n) : (i + 1) + " / " + n;
    q(".tour-title").textContent = s.title || "";
    q(".tour-body").textContent = s.body || "";
    q(".tour-actions").innerHTML =
      (last ? "" : '<button type="button" class="tour-skip" data-tour="skip">' + esc(L.skip || "Skip") + "</button>") +
      (i ? '<button type="button" class="tour-btn tour-back" data-tour="back">' + esc(L.back || "Back") + "</button>" : "") +
      '<button type="button" class="tour-btn tour-next" data-tour="next">' + esc(last ? L.done || "Done" : L.next || "Next") + "</button>";
    b.classList.remove("tour-in"); void b.offsetWidth; b.classList.add("tour-in"); // replay the entrance on every step
    layout(true, true);
    b.querySelector('[data-tour="next"]').focus({ preventScroll: true });
  }

  function onClick(e) {
    const a = e.target.closest("[data-tour]");
    if (!a || !st) return;
    const act = a.getAttribute("data-tour");
    if (act === "skip") end(false);
    else if (act === "back") go(Math.max(0, st.i - 1));
    else if (st.i === st.steps.length - 1) end(true);
    else go(st.i + 1);
  }
  function buttons() { return Array.prototype.slice.call(st.bubble.querySelectorAll("button")); }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(false); return; }
    if (e.key !== "Tab") return;
    const f = buttons(), first = f[0], lastB = f[f.length - 1], a = document.activeElement;
    if (!st.bubble.contains(a)) { e.preventDefault(); (e.shiftKey ? lastB : first).focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); lastB.focus(); }
    else if (!e.shiftKey && a === lastB) { e.preventDefault(); first.focus(); }
  }
  function onFocusIn(e) {
    if (st && !st.bubble.contains(e.target)) { const nx = st.bubble.querySelector('[data-tour="next"]'); if (nx) nx.focus({ preventScroll: true }); }
  }

  // steps: [{target: selector | () => Element | [those, largest first] | null, tab, title, body, media (trusted HTML)}]
  // opts: {labels: {next, back, skip, done, count(n, total)}, switchTab(tab), onEnd(finished), inset() -> px a sticky header covers,
  //        fallbackFocus() -> element to focus at the end when the one focused at the start is gone or hidden}
  function start(steps, opts) {
    if (st || !steps || !steps.length) return false;
    const root = document.createElement("div");
    root.className = "tour";
    root.innerHTML = '<div class="tour-block"></div><div class="tour-spot"></div>' +
      '<div class="tour-bubble" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourBody">' +
      '<div class="tour-media"></div><div class="tour-text" aria-live="polite" aria-atomic="true"><p class="tour-count"></p>' +
      '<h2 class="tour-title" id="tourTitle"></h2><p class="tour-body" id="tourBody"></p></div><div class="tour-actions"></div></div>';
    document.body.appendChild(root);
    st = { steps, opts: opts || {}, i: 0, pick: 0, key: "", root, spot: root.children[1], bubble: root.children[2], prevFocus: document.activeElement };
    st.bubble.addEventListener("click", onClick);
    root.firstChild.addEventListener("mousedown", e => e.preventDefault()); // a click on the scrim keeps focus in the bubble
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("resize", onMove);
    window.addEventListener("orientationchange", onMove);
    window.addEventListener("scroll", onMove, true);
    // Content that grows or moves without a scroll/resize (a coach note arriving, webfonts loading) re-places the spotlight.
    // ResizeObserver runs after layout and before paint, so re-placing right there keeps the cut-out on the target in the same frame.
    if (typeof ResizeObserver === "function") { ro = new ResizeObserver(() => layout(false, false)); ro.observe(document.body); ro.observe(st.bubble); }
    try { go(0); } catch (e) { report(e); end(false); return false; } // never leave a scrim without buttons
    return true;
  }
  function end(finished) {
    if (!st) return;
    const s = st;
    st = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("focusin", onFocusIn);
    window.removeEventListener("resize", onMove);
    window.removeEventListener("orientationchange", onMove);
    window.removeEventListener("scroll", onMove, true);
    if (ro) { ro.disconnect(); ro = null; }
    s.root.remove();
    // onEnd first, so a restored tab makes the old focus target visible again
    if (s.opts.onEnd) { try { s.opts.onEnd(!!finished); } catch (e) { report(e); } }
    let pf = s.prevFocus;
    if (!pf || pf === document.body || !document.contains(pf) || pf.offsetParent === null) // e.g. a button in a now-closed dialog
      pf = s.opts.fallbackFocus ? s.opts.fallbackFocus() : null;
    if (pf && pf.focus) { try { pf.focus({ preventScroll: true }); } catch (e) {} }
  }
  function active() { return !!st; }

  return { start, end, active, place, PAD, GAP, GUTTER };
})();
if (typeof module !== "undefined") module.exports = Tour; else window.Tour = Tour;
