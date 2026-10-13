/* =========================================================
   SMB31202 deck engine
   - Turns <section class="slide"> into a navigable deck
   - Builds top bar, bottom nav, contents drawer, progress
   - Auto-wires interactive widgets and awards XP
   - Saves progress per week in localStorage (fails safely)
   Usage: <body data-week="07" data-title="Graphics & Visuals">
   ========================================================= */
(function () {
  "use strict";

  /* ---------- storage (safe) ---------- */
  var KEY = "smb31202.progress.v1";
  var store = { weeks: {}, drafts: {}, checks: {} };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) store = Object.assign(store, JSON.parse(raw));
  } catch (e) { /* private mode or blocked: run without saving */ }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
  }

  var body = document.body;
  var WEEK = body.getAttribute("data-week") || "00";
  var TITLE = body.getAttribute("data-title") || document.title;
  var wk = store.weeks[WEEK] || (store.weeks[WEEK] = { seen: [], earned: {}, last: 0, total: 0 });
  wk.seen = wk.seen || []; wk.earned = wk.earned || {};

  function xpTotal() {
    var t = 0; for (var k in wk.earned) t += wk.earned[k]; return t;
  }

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var a in attrs) {
      if (a === "class") n.className = attrs[a]; else n.setAttribute(a, attrs[a]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  }
  function norm(s) { return String(s).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim(); }
  function wordCount(s) { var m = s.trim().match(/\S+/g); return m ? m.length : 0; }

  /* ---------- chrome ---------- */
  var slides = $$(".slide");
  if (!slides.length) return;

  var top = el("header", { class: "deck-top" },
    '<a class="deck-top__home" href="../index.html" aria-label="Back to course home">' +
      '<span class="deck-top__logo">ETC</span><span class="long">SMB31202</span></a>' +
    '<div class="deck-top__title">Week ' + WEEK.replace(/^0/, "") + " · " + TITLE + "</div>" +
    '<div class="deck-top__xp" title="Experience points earned this week">⚡ <span id="xpVal">0</span> XP</div>' +
    '<button class="btn btn--ghost" id="tocBtn" aria-controls="toc" aria-expanded="false">☰ Contents</button>');
  var bar = el("div", { class: "progress", role: "progressbar", "aria-label": "Lesson progress" });
  var nav = el("nav", { class: "deck-nav", "aria-label": "Slide navigation" },
    '<button class="btn" id="prevBtn" aria-label="Previous slide">← <span class="lbl">Back</span></button>' +
    '<div class="deck-nav__count" id="count" aria-live="polite"></div>' +
    '<button class="btn btn--primary" id="nextBtn" aria-label="Next slide"><span class="lbl">Next</span> →</button>');
  var toc = el("aside", { class: "toc", id: "toc", "aria-label": "Contents" },
    '<div class="toc__head"><strong>Contents</strong><button class="btn btn--sm" id="tocClose">✕ Close</button></div><ul class="toc__list" id="tocList"></ul>' +
    '<div style="padding:.8rem 1.1rem;border-top:1px solid var(--line)" class="small muted">Keys: <kbd>←</kbd> <kbd>→</kbd> move · <kbd>C</kbd> contents</div>');
  var scrim = el("div", { class: "scrim" });
  var toast = el("div", { class: "toast", role: "status", "aria-live": "polite" });
  body.insertBefore(bar, body.firstChild);
  body.insertBefore(top, body.firstChild);
  body.appendChild(nav); body.appendChild(toc); body.appendChild(scrim); body.appendChild(toast);

  var xpVal = $("#xpVal");
  function renderXP(bump) {
    xpVal.textContent = xpTotal();
    if (bump) { var x = $(".deck-top__xp"); x.classList.remove("bump"); void x.offsetWidth; x.classList.add("bump"); }
  }
  var toastTimer;
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  /* XP: each widget gets a stable id from its order on the page */
  var widgetSeq = 0;
  function widgetId(prefix) { widgetSeq += 1; return prefix + widgetSeq; }
  function award(id, pts, chip) {
    pts = pts || 10;
    if (chip) { chip.classList.add("earned"); }
    if (wk.earned[id]) return false;
    wk.earned[id] = pts; save(); renderXP(true);
    showToast("+" + pts + " XP");
    return true;
  }
  function xpChip(host, id, pts) {
    var c = el("span", { class: "xp-chip" }, "+" + pts + " XP");
    if (wk.earned[id]) c.classList.add("earned");
    host.appendChild(c);
    return c;
  }
  function headFor(node, label, id, pts) {
    var h = el("div", { class: "widget__head" }, "<span>" + label + "</span>");
    var chip = xpChip(h, id, pts);
    node.insertBefore(h, node.firstChild);
    return chip;
  }

  /* ---------- contents drawer ---------- */
  var tocList = $("#tocList");
  slides.forEach(function (s, i) {
    var t = s.getAttribute("data-title") || ($("h1, h2, h3", s) || {}).textContent || "Slide " + (i + 1);
    var li = el("li", s.classList.contains("slide--part") ? { class: "toc__part" } : null);
    var b = el("button", { type: "button", "data-i": i }, '<span class="toc__n">' + (i + 1) + "</span><span>" + t.trim() + "</span>");
    b.addEventListener("click", function () { go(i); closeToc(); });
    li.appendChild(b); tocList.appendChild(li);
  });
  function openToc() { toc.classList.add("is-open"); scrim.classList.add("is-open"); $("#tocBtn").setAttribute("aria-expanded", "true"); }
  function closeToc() { toc.classList.remove("is-open"); scrim.classList.remove("is-open"); $("#tocBtn").setAttribute("aria-expanded", "false"); }
  $("#tocBtn").addEventListener("click", function () { toc.classList.contains("is-open") ? closeToc() : openToc(); });
  $("#tocClose").addEventListener("click", closeToc);
  scrim.addEventListener("click", closeToc);

  /* ---------- navigation ---------- */
  var cur = -1;
  wk.total = slides.length;
  function go(i, fromHash) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === cur) return;
    var back = i < cur;
    if (cur >= 0) slides[cur].classList.remove("is-active", "is-back");
    cur = i;
    var s = slides[cur];
    s.classList.toggle("is-back", back);
    s.classList.add("is-active");
    if (wk.seen.indexOf(cur) < 0) wk.seen.push(cur);
    wk.last = cur; save();
    $("#count").textContent = (cur + 1) + " / " + slides.length;
    $("#prevBtn").disabled = cur === 0;
    $("#nextBtn").disabled = cur === slides.length - 1;
    bar.style.width = ((cur + 1) / slides.length * 100) + "%";
    $$("#tocList button").forEach(function (b, j) {
      b.classList.toggle("is-current", j === cur);
      b.classList.toggle("is-seen", wk.seen.indexOf(j) >= 0);
    });
    if (!fromHash) { try { history.replaceState(null, "", "#" + (cur + 1)); } catch (e) {} }
    window.scrollTo(0, 0);
    s.dispatchEvent(new CustomEvent("slide:enter", { bubbles: true }));
  }
  $("#prevBtn").addEventListener("click", function () { go(cur - 1); });
  $("#nextBtn").addEventListener("click", function () { go(cur + 1); });

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(cur + 1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(cur - 1); }
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(slides.length - 1);
    else if (e.key === "c" || e.key === "C") { toc.classList.contains("is-open") ? closeToc() : openToc(); }
    else if (e.key === "Escape") closeToc();
  });

  /* swipe */
  var sx = null, sy = null;
  document.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    var t = e.target;
    var inWidget = t.closest && t.closest("textarea, input, .table-wrap, .sorter, .timer, .flip");
    if (!inWidget && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) go(cur + (dx < 0 ? 1 : -1));
    sx = sy = null;
  }, { passive: true });

  window.addEventListener("hashchange", function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (n) go(n - 1, true);
  });

  /* ---------- widgets ---------- */

  // Multiple choice: .quiz > .quiz__q + .quiz__opts > button[data-correct] (+ data-why)
  $$(".quiz").forEach(function (q) {
    var pts = +(q.getAttribute("data-xp") || 10);
    var id = widgetId("quiz");
    var chip = headFor(q, q.getAttribute("data-label") || "Quick check", id, pts);
    var fb = $(".quiz__fb", q) || q.appendChild(el("p", { class: "quiz__fb" }));
    var btns = $$(".quiz__opts button", q);
    var keys = "ABCDEFGH";
    var tries = 0;
    btns.forEach(function (b, i) {
      b.type = "button";
      b.setAttribute("data-key", keys[i]);
      b.addEventListener("click", function () {
        tries++;
        var right = b.hasAttribute("data-correct");
        var why = b.getAttribute("data-why");
        if (right) {
          b.classList.add("is-right");
          btns.forEach(function (x) { x.disabled = true; });
          fb.className = "quiz__fb ok";
          fb.innerHTML = "✓ " + (why || q.getAttribute("data-right") || "Correct!");
          award(id, tries === 1 ? pts : Math.ceil(pts / 2), chip);
        } else {
          b.classList.add("is-wrong"); b.disabled = true;
          fb.className = "quiz__fb no";
          fb.innerHTML = "✗ " + (why || q.getAttribute("data-wrong") || "Not quite. Try again.");
        }
      });
    });
  });

  // Reveal: <details class="reveal" data-xp="5"><summary>..</summary><div class="reveal__body">..</div></details>
  $$("details.reveal").forEach(function (d) {
    var pts = +(d.getAttribute("data-xp") || 0);
    if (!pts) return;
    var id = widgetId("rev");
    d.addEventListener("toggle", function () { if (d.open) award(id, pts); });
  });

  // Flip cards: .flip > .flip__front + .flip__back
  $$(".flip").forEach(function (f) {
    if (!$(".flip__inner", f)) {
      var inner = el("div", { class: "flip__inner" });
      while (f.firstChild) inner.appendChild(f.firstChild);
      f.appendChild(inner);
    }
    f.setAttribute("role", "button"); f.setAttribute("tabindex", "0");
    f.setAttribute("aria-pressed", "false");
    function flip() { f.classList.toggle("is-flipped"); f.setAttribute("aria-pressed", f.classList.contains("is-flipped")); }
    f.addEventListener("click", flip);
    f.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
  });
  $$(".flip-grid[data-xp]").forEach(function (g) {
    var pts = +g.getAttribute("data-xp"); var id = widgetId("flip");
    var cards = $$(".flip", g), seen = {};
    cards.forEach(function (c, i) {
      c.addEventListener("click", function () { seen[i] = 1; if (Object.keys(seen).length === cards.length) award(id, pts); });
    });
  });

  // Sorter: .sorter[data-xp] > .sorter__pool > .chip[data-bin] ; .sorter__bins > .bin[data-bin] (> .bin__label)
  $$(".sorter").forEach(function (s) {
    var pts = +(s.getAttribute("data-xp") || 15);
    var id = widgetId("sort");
    var chip = headFor(s, s.getAttribute("data-label") || "Sort it", id, pts);
    var pool = $(".sorter__pool", s);
    var chips = $$(".chip", pool);
    // shuffle chips
    for (var i = chips.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); pool.appendChild(chips[j]); chips.splice(j, 1); }
    chips = $$(".chip", pool);
    var fb = $(".sorter__fb", s) || s.appendChild(el("p", { class: "sorter__fb" }));
    var bins = $$(".bin", s);
    bins.forEach(function (b) {
      if (!$(".bin__items", b)) b.appendChild(el("div", { class: "bin__items" }));
      b.setAttribute("role", "button"); b.setAttribute("tabindex", "0");
      b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); b.click(); } });
    });
    var picked = null, mistakes = 0, placed = 0;
    chips.forEach(function (c) {
      c.setAttribute("type", "button");
      c.addEventListener("click", function (e) {
        e.stopPropagation();
        if (c.classList.contains("is-right")) return;
        if (picked) picked.classList.remove("is-picked");
        picked = picked === c ? null : c;
        if (picked) picked.classList.add("is-picked");
        bins.forEach(function (b) { b.classList.toggle("is-ready", !!picked); });
        fb.textContent = picked ? "Now tap the box where it belongs." : "";
      });
    });
    bins.forEach(function (b) {
      b.addEventListener("click", function () {
        if (!picked) { fb.textContent = "Tap an item first, then tap a box."; return; }
        var want = picked.getAttribute("data-bin").split("|");
        if (want.indexOf(b.getAttribute("data-bin")) >= 0) {
          picked.classList.remove("is-picked"); picked.classList.add("is-right");
          $(".bin__items", b).appendChild(picked); placed++;
          picked = null; bins.forEach(function (x) { x.classList.remove("is-ready"); });
          fb.className = "sorter__fb"; fb.style.color = "var(--ok)";
          if (placed === chips.length) {
            fb.textContent = mistakes === 0 ? "🎯 Perfect sort, no mistakes!" : "✓ All sorted (" + mistakes + " slip" + (mistakes > 1 ? "s" : "") + " on the way).";
            award(id, mistakes === 0 ? pts : Math.max(5, pts - mistakes * 2), chip);
          } else fb.textContent = "✓ Yes. " + (chips.length - placed) + " to go.";
        } else {
          mistakes++;
          var p = picked; p.classList.add("is-wrong"); setTimeout(function () { p.classList.remove("is-wrong"); }, 400);
          fb.style.color = "var(--bad)";
          fb.textContent = picked.getAttribute("data-why") || "Not that one. Think again.";
        }
      });
    });
  });

  // Gap fill: .gapfill[data-xp] with <input class="gap" data-answer="a|b">
  $$(".gapfill").forEach(function (g) {
    var pts = +(g.getAttribute("data-xp") || 15);
    var id = widgetId("gap");
    var chip = headFor(g, g.getAttribute("data-label") || "Fill the gaps", id, pts);
    var gaps = $$("input.gap", g);
    gaps.forEach(function (i) { i.setAttribute("autocomplete", "off"); i.setAttribute("spellcheck", "false"); i.setAttribute("aria-label", "Gap"); });
    var actions = el("div", { class: "gapfill__actions" },
      '<button class="btn btn--sm btn--primary" type="button">Check</button><button class="btn btn--sm" type="button">Show answers</button><span class="gapfill__fb"></span>');
    g.appendChild(actions);
    var fb = $(".gapfill__fb", actions);
    var shown = false;
    $$("button", actions)[0].addEventListener("click", function () {
      var ok = 0;
      gaps.forEach(function (i) {
        var ans = i.getAttribute("data-answer").split("|").map(norm);
        var good = ans.indexOf(norm(i.value)) >= 0;
        i.classList.toggle("is-right", good); i.classList.toggle("is-wrong", !good);
        if (good) ok++;
      });
      fb.textContent = ok + " / " + gaps.length + " correct";
      fb.style.color = ok === gaps.length ? "var(--ok)" : "var(--amber)";
      if (ok === gaps.length && !shown) award(id, pts, chip);
    });
    $$("button", actions)[1].addEventListener("click", function () {
      shown = true;
      gaps.forEach(function (i) { i.value = i.getAttribute("data-answer").split("|")[0]; i.classList.add("is-right"); i.classList.remove("is-wrong"); });
      fb.textContent = "Answers shown (no XP).";
      fb.style.color = "var(--muted)";
    });
  });

  // Writing pad: .write[data-min][data-max][data-xp] > textarea (draft saved)
  $$(".write").forEach(function (w) {
    var pts = +(w.getAttribute("data-xp") || 20);
    var min = +(w.getAttribute("data-min") || 0), max = +(w.getAttribute("data-max") || 0);
    var id = widgetId("write");
    var key = WEEK + ":" + id;
    var chip = headFor(w, w.getAttribute("data-label") || "Your turn: write", id, pts);
    var ta = $("textarea", w) || w.appendChild(el("textarea"));
    if (!ta.getAttribute("aria-label")) ta.setAttribute("aria-label", "Your writing");
    if (store.drafts[key]) ta.value = store.drafts[key];
    var meta = el("div", { class: "write__meta" },
      '<span class="write__count">0 words</span><div class="write__meter"><span></span></div><span class="write__target">' +
      (min || max ? "Target " + (min || 0) + (max ? "–" + max : "+") + " words" : "") + "</span>");
    ta.after(meta);
    var cnt = $(".write__count", meta), fill = $(".write__meter span", meta);
    var t;
    function upd() {
      var n = wordCount(ta.value);
      cnt.textContent = n + " word" + (n === 1 ? "" : "s");
      var inRange = (!min || n >= min) && (!max || n <= max);
      cnt.classList.toggle("in", inRange && n > 0);
      cnt.classList.toggle("over", !!max && n > max);
      fill.style.width = Math.min(100, (n / (max || min || 100)) * 100) + "%";
      if (min && n >= min) award(id, pts, chip);
    }
    ta.addEventListener("input", function () {
      upd(); clearTimeout(t);
      t = setTimeout(function () { store.drafts[key] = ta.value; save(); }, 400);
    });
    upd();
  });

  // Checklist: ul.checklist > li (text)
  $$("ul.checklist").forEach(function (ul) {
    var pts = +(ul.getAttribute("data-xp") || 0);
    var id = widgetId("check");
    var items = $$("li", ul);
    var barEl = el("div", { class: "checklist__bar" });
    ul.after(barEl);
    items.forEach(function (li, i) {
      var k = WEEK + ":" + id + ":" + i;
      var html = li.innerHTML;
      li.innerHTML = "";
      var lab = el("label");
      var cb = el("input", { type: "checkbox" });
      cb.checked = !!store.checks[k];
      lab.appendChild(cb); lab.appendChild(el("span", null, html));
      li.appendChild(lab);
      cb.addEventListener("change", function () { store.checks[k] = cb.checked; save(); upd(); });
    });
    function upd() {
      var done = $$("input", ul).filter(function (c) { return c.checked; }).length;
      barEl.textContent = done + " / " + items.length + " ticked";
      if (pts && done === items.length) award(id, pts);
    }
    upd();
  });

  // Build steps: ol.steps[data-build] -> reveal one at a time
  $$("ol.steps[data-build]").forEach(function (ol) {
    var lis = $$(":scope > li", ol);
    var shown = 1;
    ol.classList.add("is-building");
    var btn = el("button", { class: "btn btn--sm steps__btn", type: "button" }, "Reveal next ▸");
    ol.before(btn);
    function upd() {
      lis.forEach(function (li, i) { li.classList.toggle("is-hidden", i >= shown); });
      if (shown >= lis.length) { btn.textContent = "All shown ✓"; btn.disabled = true; }
    }
    btn.addEventListener("click", function () { shown++; upd(); });
    upd();
  });

  // Tabs: .tabs > .tabs__bar > button[data-tab] ; .tabs__panel[data-panel]
  $$(".tabs").forEach(function (t) {
    var btns = $$(".tabs__bar button", t), panels = $$(".tabs__panel", t);
    t.querySelector(".tabs__bar").setAttribute("role", "tablist");
    function show(name) {
      btns.forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === name ? "true" : "false"); });
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    }
    btns.forEach(function (b) { b.type = "button"; b.setAttribute("role", "tab"); b.addEventListener("click", function () { show(b.getAttribute("data-tab")); }); });
    if (btns[0]) show(btns[0].getAttribute("data-tab"));
  });

  // Timer: .timer[data-phases='[{"label":"Prep","sec":120,"hint":"..."}]']
  $$(".timer").forEach(function (tm) {
    var phases;
    try { phases = JSON.parse(tm.getAttribute("data-phases")); } catch (e) { phases = [{ label: "Timer", sec: 60 }]; }
    var pts = +(tm.getAttribute("data-xp") || 0);
    var id = widgetId("timer");
    tm.innerHTML =
      (tm.getAttribute("data-label") ? '<div class="widget__head" style="justify-content:center"><span>' + tm.getAttribute("data-label") + "</span></div>" : "") +
      '<div class="timer__phase"></div><div class="timer__clock" aria-live="off">0:00</div>' +
      '<div class="timer__track">' + phases.map(function () { return '<div class="timer__seg"><span></span></div>'; }).join("") + "</div>" +
      '<div class="timer__labels">' + phases.map(function (p) { return "<div>" + p.label + "</div>"; }).join("") + "</div>" +
      '<div class="timer__btns"><button class="btn btn--primary btn--sm" type="button">▶ Start</button><button class="btn btn--sm" type="button">⏭ Skip</button><button class="btn btn--sm" type="button">↺ Reset</button></div>' +
      '<div class="timer__hint"></div>';
    var phaseEl = $(".timer__phase", tm), clock = $(".timer__clock", tm), hint = $(".timer__hint", tm);
    var segs = $$(".timer__seg", tm), b = $$(".timer__btns button", tm);
    var pi = 0, left = phases[0].sec, running = false, iv = null;
    function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }
    function beep() {
      try {
        var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        var ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.start(); o.stop(ctx.currentTime + 0.5);
      } catch (e) {}
    }
    function render() {
      var p = phases[pi];
      phaseEl.textContent = p ? "Phase " + (pi + 1) + " of " + phases.length + " · " + p.label : "Finished";
      clock.textContent = fmt(Math.max(0, left));
      hint.textContent = p && p.hint ? p.hint : (p ? "" : "Time! Well done. Now give feedback.");
      tm.classList.toggle("is-low", !!p && left <= 10 && running);
      segs.forEach(function (s, i) {
        s.classList.toggle("done", i < pi);
        var sp = s.firstChild;
        sp.style.width = i === pi && p ? ((p.sec - left) / p.sec * 100) + "%" : (i < pi ? "100%" : "0");
      });
    }
    function next() {
      pi++; beep();
      if (pi >= phases.length) { stop(); left = 0; render(); if (pts) award(id, pts); return; }
      left = phases[pi].sec; render();
    }
    function tick() { left--; if (left < 0) next(); else render(); }
    function start() { if (pi >= phases.length) reset(); running = true; iv = setInterval(tick, 1000); b[0].textContent = "⏸ Pause"; render(); }
    function stop() { running = false; clearInterval(iv); b[0].textContent = "▶ Start"; }
    function reset() { stop(); pi = 0; left = phases[0].sec; render(); }
    b[0].addEventListener("click", function () { running ? stop() : start(); });
    b[1].addEventListener("click", function () { if (pi < phases.length) next(); });
    b[2].addEventListener("click", reset);
    render();
  });

  // Self-rating: .rate[data-min][data-max] > label + input range
  $$(".rate").forEach(function (r) {
    var min = r.getAttribute("data-min") || 1, max = r.getAttribute("data-max") || 10;
    var id = widgetId("rate"), key = WEEK + ":" + id;
    var label = r.innerHTML;
    r.innerHTML = '<div class="small muted" style="margin-bottom:.5rem">' + label + '</div><div class="rate__row"><span class="small mono">' + min + '</span><input type="range" min="' + min + '" max="' + max + '" step="1"><span class="small mono">' + max + '</span><span class="rate__val"></span></div>';
    var inp = $("input", r), val = $(".rate__val", r);
    inp.setAttribute("aria-label", r.textContent.trim().slice(0, 80));
    inp.value = store.drafts[key] || Math.round((+min + +max) / 2);
    function upd() { val.textContent = inp.value; store.drafts[key] = inp.value; save(); }
    inp.addEventListener("input", upd); upd();
  });

  // Random picker: .picker[data-items='["a","b"]'] (data-label)
  $$(".picker").forEach(function (p) {
    var items; try { items = JSON.parse(p.getAttribute("data-items")); } catch (e) { items = []; }
    p.innerHTML = '<div class="widget__head" style="justify-content:center"><span>' + (p.getAttribute("data-label") || "Random pick") + '</span></div><div class="picker__out">Press spin</div><button class="btn btn--primary btn--sm" type="button">🎲 Spin</button>';
    var out = $(".picker__out", p);
    $("button", p).addEventListener("click", function () {
      var n = 0; out.classList.add("spinning");
      var iv = setInterval(function () {
        out.textContent = items[Math.floor(Math.random() * items.length)];
        if (++n > 14) { clearInterval(iv); out.classList.remove("spinning"); }
      }, 70);
    });
  });

  // Animated horizontal bars: .hbar__fill[data-v][data-max]
  function animateBars(root) {
    $$(".hbar__fill", root).forEach(function (f) {
      f.style.width = "0";
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        f.style.width = (+f.getAttribute("data-v") / +(f.getAttribute("data-max") || 100) * 100) + "%";
      }); });
    });
  }
  document.addEventListener("slide:enter", function (e) { animateBars(e.target); });

  // Finale: .finale shows XP + stats; [data-confetti]
  function renderFinale(f) {
    var x = $(".finale__xp", f); if (x) x.textContent = xpTotal() + " XP";
    var s = $(".finale__stats", f);
    if (s) s.innerHTML = "<div><b>" + wk.seen.length + "/" + slides.length + "</b>slides seen</div><div><b>" + Object.keys(wk.earned).length + "</b>activities done</div>";
  }
  document.addEventListener("slide:enter", function (e) {
    var f = $(".finale", e.target);
    if (f) { renderFinale(f); confetti(); }
  });

  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var c = el("canvas", { style: "position:fixed;inset:0;pointer-events:none;z-index:100", "aria-hidden": "true" });
    document.body.appendChild(c);
    var ctx = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
    var cols = ["#3ee6ff", "#9b7bff", "#ff5fd2", "#8dff6a", "#ffc24b"], ps = [];
    for (var i = 0; i < 140; i++) ps.push({ x: c.width / 2, y: c.height / 3, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 3, s: Math.random() * 6 + 3, c: cols[i % 5], r: Math.random() * 6 });
    var f = 0;
    (function loop() {
      ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach(function (p) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); });
      if (++f < 150) requestAnimationFrame(loop); else c.remove();
    })();
  }

  /* expose a tiny API for week-specific scripts */
  window.Deck = { award: award, widgetId: widgetId, go: go, toast: showToast, week: WEEK };

  /* ---------- start ---------- */
  renderXP(false);
  var start = parseInt(location.hash.slice(1), 10);
  go(start ? start - 1 : (wk.last || 0), !!start);
})();
