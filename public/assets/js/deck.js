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
  wk.seen = wk.seen || []; wk.earned = wk.earned || {}; wk.done = wk.done || {}; wk.scroll = wk.scroll || 0; wk.viewed = wk.viewed || {};

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

  /* ---------- issue content (images + next issue) ---------- */
  var TITLES = ["Basics of Technical Communication", "Preparing for the Workplace", "Research Skills & Paraphrasing", "Reading Skills for Technical Communication", "Writing for Technical Communication", "Drawing Conclusions & Referencing", "Graphics & Visuals in Technical Communication", "Reading Test", "Language Skills for Technical Writing", "Writing Test & Poster Supervision 2", "Group Communication", "Speaking Practice & Final Consultation", "Speaking Assessment · Part 1", "Speaking Assessment · Part 2"];
  var COURSEPAGE = body.classList.contains("lab-course");
  var ROOTP = COURSEPAGE ? "" : "../";
  var IMG = ROOTP + "assets/img/";
  // first image = cover; the rest are used for chapter openers and photo breaks
  var PHOTOS = {
    1: ["team-casual", "team-office", "whiteboard", "business-team", "sticky-notes"],
    2: ["handshake", "laptop-notes", "writing-hand", "business-team", "team-office", "typing", "pen-paper"],
    3: ["books-stack", "laptop-notes-2", "dashboard", "books-desk", "stock-chart"],
    4: ["books-desk", "writing-hand", "lecture-hall", "pen-paper", "books-dark", "students-class"],
    5: ["writing-hand", "dashboard", "pen-paper", "chart-screen", "laptop-notes"],
    6: ["books-dark", "sticky-notes", "pen-hold", "lecture-hall", "books-stack", "whiteboard"],
    7: ["dashboard", "stock-chart", "chart-screen", "board-pins", "whiteboard", "hourglass"],
    8: ["exam-hall", "students-class", "lecture-hall", "pen-hold"],
    9: ["typing", "pen-paper", "hourglass", "laptop-notes-2", "chart-screen"],
    10: ["pen-hold", "hourglass", "whiteboard", "laptop-notes", "exam-hall"],
    11: ["team-table", "team-casual", "whiteboard", "business-team", "team-office"],
    12: ["business-team", "team-table", "board-pins", "hourglass"],
    13: ["lecture-hall", "business-team", "hourglass", "students-class"],
    14: ["handshake", "team-table", "lecture-hall", "business-team"]
  };
  var WN = body.classList.contains("lab-course") ? 0 : (parseInt(WEEK, 10) || 1);
  var EXTRA = ["g-office", "g-solar", "g-datacentre", "g-robot", "g-wind", "g-rooftop", "g-ev", "g-chart", "g-library", "g-students"];
  var pool = [WN ? "wk" + WEEK : "hero"].concat(EXTRA.slice((WN * 3) % EXTRA.length).concat(EXTRA.slice(0, (WN * 3) % EXTRA.length)));
  function photoUrl(i) { return IMG + pool[i % pool.length] + ".jpg"; }
  var STATIC = /[?&]static\b/.test(location.search);
  var LAB = window.LAB;
  var COURSE = window.COURSE || { weeks: [] };
  var HOOK = (window.HOOKS || {})[WN] || null;
  var WINFO = COURSE.weeks.filter(function (w) { return w.n === WN; })[0] || {};

  /* ---------- chrome ---------- */
  var slides = $$(".slide");
  if (!slides.length) return;
  body.classList.add("lab-week");
  body.setAttribute("data-root", ROOTP);
  if (LAB) LAB.nav(WN ? "w" + WEEK : "course", LAB.totalXp());

  var toc = el("aside", { class: "toc", id: "toc", "aria-label": "Contents" },
    '<div class="toc__head"><strong>Contents</strong><button class="btn btn--sm" id="tocClose">Close</button></div><ul class="toc__list" id="tocList"></ul>' +
    '<div style="padding:.8rem 1.1rem;border-top:1px solid var(--line)" class="small muted">Press <kbd>C</kbd> to open or close this list.</div>');
  var scrim = el("div", { class: "scrim" });
  var toast = el("div", { class: "toast", role: "status", "aria-live": "polite" });
  body.appendChild(toc); body.appendChild(scrim); body.appendChild(toast);

  function renderXP(bump) {
    var x = $("#wkXp"); if (x) x.textContent = xpTotal() + " XP";
    if (LAB) LAB.setXp(LAB.totalXp(), bump);
    if (bump && x) { x.classList.remove("bump"); void x.offsetWidth; x.classList.add("bump"); }
  }
  var toastTimer;
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  /* XP: each widget gets a stable id from its order on the page */
  var widgetSeq = 0;
  function widgetId(prefix) { widgetSeq += 1; return prefix + widgetSeq; }
  var REQ = [];   // required activities: { id, label, el }
  var LIGHT_SHARE = 0.7; // share of the small activities needed for attendance; write pads, wall post and boss round are always required
  function require(id, label, el, core) { var sl = el && el.closest ? el.closest(".slide, section") : null; var t = sl ? (sl.getAttribute("data-title") || "").replace(/^Part [A-Z0-9]+\s*[·:\-–]\s*/i, "") : ""; REQ.push({ id: id, label: label + (t && label.indexOf(t) < 0 ? " · " + t : ""), el: el, core: !!core }); }
  function markDone(id) { if (wk.done[id]) return; wk.done[id] = 1; save(); if (window.__missionTick) window.__missionTick(); }
  function award(id, pts, chip) {
    pts = pts || 10;
    markDone(id);
    if (chip) { chip.classList.add("earned"); }
    if (wk.earned[id]) return false;
    wk.earned[id] = pts; save(); renderXP(true);
    showToast("+" + pts + " XP");
    if (LAB) LAB.syncBoard();
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

  /* ---------- lesson hero + mission rail ---------- */
  var main = $("main.deck") || slides[0].parentNode;
  var titleSlide = slides[0].classList.contains("slide--title") ? slides[0] : null;
  var heroTitle = (titleSlide && $("h1", titleSlide) ? $("h1", titleSlide).textContent : TITLE).trim();
  var heroLead = (titleSlide && $(".slide__lead", titleSlide) ? $(".slide__lead", titleSlide).textContent : "").trim();
  var modeLabel = (LAB && LAB.MODE[WINFO.mode]) || "";
  var dates = WINFO.start && LAB ? LAB.fmtRange(WINFO.start, WINFO.end) : "";
  var isNow = LAB && LAB.currentWeek() === WN;
  var hero = el("section", { class: "lhero", id: "top" },
    '<div class="lh-media" data-para><img src="' + photoUrl(0) + '" alt="" decoding="async" fetchpriority="high"></div>' +
    '<div class="lh-in"><span class="lh-num lab-grad" aria-hidden="true">' + (WN ? WEEK : 'ETC') + '</span>' +
    '<p class="eyebrow">' + (WN ? 'Week ' + WN : 'SMB31202 · Semester 1 · 2026/2027') + (modeLabel ? " · " + modeLabel : "") + (dates ? " · " + dates : "") + "</p>" +
    "<h1>" + (LAB ? LAB.words(heroTitle) : heroTitle) + "</h1>" +
    (heroLead ? '<p class="lede">' + heroLead + "</p>" : "") +
    '<div class="meta">' + (isNow ? '<span class="hot">This week</span>' : "") + (modeLabel ? "<span>" + modeLabel + "</span>" : "") + (WINFO.flag ? "<span>" + WINFO.flag + "</span>" : "") + (HOOK ? "<span>Hook · Learn · Try · Wall · Boss</span>" : "") + "</div></div>");
  var railHtml = WN ? '<nav class="rail" aria-label="Mission stages"><a href="#hook" data-stage="hook"><i></i>Hook</a><a href="#learn" data-stage="learn"><i></i>Learn</a><a href="#try" data-stage="try"><i></i>Try</a><a href="#wall" data-stage="wall"><i></i>Wall</a><a href="#boss" data-stage="boss"><i></i>Boss</a></nav>' : '<span></span>';
  var lnav = el("div", { class: "lnav" },
    '<div class="lnav-in"><strong>' + TITLE + '</strong>' + railHtml +
    '<div class="row" style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap"><span class="gn-xp" id="wkXp" style="background:var(--text);color:#fff">0 XP</span><button class="btn btn--sm" id="tocBtn" aria-controls="toc" aria-expanded="false">Contents</button></div></div>');
  main.insertBefore(lnav, main.firstChild);
  main.insertBefore(hero, main.firstChild);

  // Hook band
  if (HOOK) {
    var gradIdx = [];
    var hw = HOOK.head.split(" ");
    for (var gi = Math.max(0, hw.length - (HOOK.words || 2)); gi < hw.length; gi++) gradIdx.push(gi);
    var hook = el("section", { class: "hook band black has-orbs", id: "hook" },
      '<div class="orbs" aria-hidden="true"><i></i><i></i><i></i></div><div class="band-in">' +
      '<div class="kick"><span class="sticker">Hook</span><span class="eyebrow" style="margin:0">Why this week matters</span></div>' +
      '<p class="scrub" data-scrub>' + (LAB ? LAB.scrubHtml(HOOK.head, gradIdx) : HOOK.head) + "</p>" +
      '<div class="scene"><div class="scene-card"><p class="lbig">' + HOOK.scene + '</p><p class="why">' + HOOK.why + "</p></div>" +
      '<div class="ask ltilt"><p class="eyebrow">Think, then tell the wall</p><p class="q">' + HOOK.ask + '</p><p class="muted">Post one or two lines. Nicknames only, no matric numbers.</p><div><a class="lbtn" href="#wall">Go to the Week ' + WN + " wall ›</a></div></div></div></div>");
    lnav.after(hook);
  }

  // chapter openers get a photo; plain sections alternate backgrounds; every 7th plain section is followed by a photo band
  var partN = 0, plainN = 0;
  slides.forEach(function (sl, i) {
    if (sl.classList.contains("slide--part")) {
      partN++;
      sl.classList.add("has-bg");
      var pbg = el("div", { class: "part-bg", "aria-hidden": "true" });
      pbg.style.backgroundImage = "url(" + photoUrl(partN) + ")";
      sl.insertBefore(pbg, sl.firstChild);
    } else if (sl !== titleSlide && !$(".finale", sl)) {
      plainN++;
      if (plainN % 2 === 0) sl.classList.add("sec--alt");
    }
  });

  // "In this issue": chapters if there are 2+, otherwise every titled section
  var tocIssue = null;
  (function () {
    var parts = slides.filter(function (x) { return x.classList.contains("slide--part"); });
    var list = parts.length >= 2 ? parts : slides.filter(function (x, i) { return i > 0 && !$(".finale", x) && x.getAttribute("data-title"); });
    if (list.length < 2) return;
    tocIssue = el("section", { class: "toc-issue" }, "<h2>In this issue</h2>");
    var ol = el("ol");
    list.forEach(function (x) {
      var t = x.getAttribute("data-title") || ($("h2, h3", x) || {}).textContent || "";
      var li = el("li", parts.length >= 2 ? { class: "is-part" } : null);
      var a = el("a", { href: "#" }, t.replace(/^Part [A-Z0-9]+\s*[·:\-–]\s*/i, "").trim());
      a.addEventListener("click", function (e) { e.preventDefault(); go(slides.indexOf(x)); });
      li.appendChild(a); ol.appendChild(li);
    });
    tocIssue.appendChild(ol);
    (titleSlide || slides[0]).after(tocIssue);
  })();

  // mission anchors: learn = first content slide, try = first interactive widget
  (function () {
    var first = slides.filter(function (s) { return s !== titleSlide && !$(".finale", s); })[0];
    if (first && !first.id) first.id = "learn";
    var firstWidget = $(".quiz, .sorter, .gapfill, .flip-grid, .write, .checklist, .timer");
    if (firstWidget) { var host = firstWidget.closest(".slide") || firstWidget; if (!host.id) host.id = "try"; else firstWidget.id = firstWidget.id || "try"; }
  })();

  // Class Wall + Boss round (before the finale)
  var finaleSlide = slides.filter(function (s) { return $(".finale", s); })[0] || slides[slides.length - 1];
  // Listening lab: dictation + record-and-compare from this week's model sentences
  var SENT = $$(".example").map(function (e) { return (e.textContent || "").replace(/\s+/g, " ").trim(); }).filter(function (t) { var n = t.split(" ").length; return n >= 6 && n <= 28 && !/\[|\]/.test(t); });
  if (LAB && WN && LAB.canSpeak && SENT.length >= 2) {
    var ll = el("section", { class: "slide listen", id: "listen", "data-title": "Listening lab" },
      '<p class="slide__kicker"><span class="tag tag--lime">Listening lab</span><span class="muted">Audio from your browser, free. Nothing is uploaded.</span></p><h2>Hear it. Type it. Say it.</h2><p class="slide__lead">The model sentences from this week, read aloud. Dictation trains the ear for the Reading Test passages; recording trains the mouth for the Speaking Assessment.</p><div data-listenmount class="mt"></div>');
    finaleSlide.before(ll);
    slides.push(ll);
  }
  var NEWSCASE = (window.NEWS || {})[WN];
  if (LAB && WN && NEWSCASE) {
    var nc = NEWSCASE, t = nc.tasks;
    function fmtDate(d) { var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; var a = d.split("-"); return (+a[2]) + " " + M[+a[1] - 1] + " " + a[0]; }
    var srcList = nc.sources.map(function (x, i) { return '<li><span class="mono small">[' + (i + 1) + ']</span> <a href="' + x.url + '" target="_blank" rel="noopener">' + LAB.esc(x.title) + "</a> <span class=\"muted small\">· " + LAB.esc(x.publisher) + " · " + fmtDate(x.date) + "</span></li>"; }).join("");
    var factList = nc.facts.map(function (f) { return "<li>" + LAB.esc(f.fact) + ' <span class="muted small">[' + f.sources.map(function (i) { return i + 1; }).join(", ") + "]</span></li>"; }).join("");
    var apaList = nc.apa.slice(0, 2).map(function (a) { return "<li>" + LAB.esc(a).replace(/(https?:\/\/\S+)/, '<a href="$1" target="_blank" rel="noopener">$1</a>') + "</li>"; }).join("");
    var quizzes = t.read.map(function (q) { return '<div class="quiz" data-xp="10" data-label="News check"><p class="quiz__q">' + LAB.esc(q[0]) + '</p><div class="quiz__opts">' + q[1].map(function (o, i) { return "<button" + (i === q[2] ? ' data-correct data-why="' + LAB.esc(q[3]) + '"' : "") + ">" + LAB.esc(o) + "</button>"; }).join("") + "</div></div>"; }).join("");
    var news = el("section", { class: "news slide", id: "news", "data-title": "Now in the news" },
      '<p class="slide__kicker"><span class="tag tag--pink">Now in the news</span>' + (nc.malaysia ? '<span class="tag">Malaysia</span>' : '<span class="tag tag--violet">Global</span>') + '<span class="muted">Figures checked against two sources · 15 Oct 2026</span></p>' +
      "<h2>" + LAB.esc(nc.headline) + "</h2>" +
      '<p class="slide__lead">' + LAB.esc(nc.summary) + "</p>" +
      '<div class="grid grid-2 news-grid"><div class="card"><h3>Verified facts</h3><ol class="news-facts">' + factList + '</ol><p class="small muted mb0">Numbers in brackets show which sources carry each figure.</p></div>' +
      '<div class="card"><h3>Sources</h3><ol class="news-src">' + srcList + '</ol><h4 class="mt">Reference list, APA 7</h4><ul class="news-apa">' + apaList + "</ul></div></div>" +
      '<div class="grid grid-3 news-tasks mt">' +
      '<div class="card card--accent"><span class="tag">Read</span><h3 class="mt">Check the facts</h3>' + quizzes + "</div>" +
      '<div class="card card--accent"><span class="tag tag--violet">Write</span><h3 class="mt">' + LAB.esc(t.write.label.replace(/^Write: /, "")) + '</h3><div class="write" data-min="' + t.write.min + '" data-max="' + t.write.max + '" data-xp="20" data-label="' + LAB.esc(t.write.label) + '"><p class="small muted">' + LAB.esc(t.write.p) + '</p><textarea placeholder="Write here. The AI coach can give feedback when you are done."></textarea></div></div>' +
      '<div class="card card--accent"><span class="tag tag--amber">Class activity · 10 min</span><h3 class="mt">In pairs or groups</h3><ol class="steps">' + t.act.map(function (a) { return "<li><div><p>" + LAB.esc(a) + "</p></div></li>"; }).join("") + '</ol><div class="timer" data-label="Activity timer" data-phases=\'[{"label":"Work","sec":480,"hint":"Talk in English. Notes are allowed."},{"label":"Share","sec":120,"hint":"One line per group to the class or the wall."}]\'></div></div></div>');
    finaleSlide.before(news);
    slides.push(news);
  }
  if (LAB && WN) {
    var wallSec = el("section", { class: "wweek has-orbs", id: "wall" },
      '<div class="orbs" aria-hidden="true"><i></i><i></i><i></i></div><div class="band-in">' +
      '<p class="eyebrow"><span class="live"></span>Live · Week ' + WN + ' board · updates every few seconds</p>' +
      '<h2 class="lbig">' + LAB.words("The Class Wall.") + "<br>" + LAB.words("Everyone’s voice.", 3, true) + "</h2>" +
      '<p class="lede">Post one or two lines. Read what the class wrote. Then we talk about it on the projector.</p>' +
      '<div data-wallmount style="margin-top:28px"></div></div>');
    finaleSlide.before(wallSec);
    var bossSec = el("section", { class: "boss", id: "boss" }, '<div class="band-in" data-bossmount></div>');
    finaleSlide.before(bossSec);
  }

  // next issue + footer (after the last slide)
  (function () {
    var last = slides[slides.length - 1];
    if (WN && WN < 14) {
      var n = WN + 1, nn = ("0" + n).slice(-2);
      var sec = el("section", { class: "next-issue" },
        '<a class="next-issue__card ltilt" href="week-' + nn + '.html"><img src="' + IMG + "wk" + nn + '.jpg" alt="" loading="lazy"><div class="next-issue__body"><div class="k">Next issue · Week ' + n + '</div><h3>' + TITLES[n - 1] + '</h3><p class="muted">Keep going. Your progress and XP are saved on this device.</p><span class="link-arrow btn--ghost">Read Week ' + n + '</span></div></a>');
      last.after(sec);
      sec.after(el("footer", { class: "site-foot" }, '<p><a href="' + ROOTP + 'index.html">← All 14 weeks</a></p><p>SMB31202 English for Technical Communication · Department of Languages &amp; General Studies, FPK, UniMAP · Semester 1, 2026/2027. Photos from Pexels and Unsplash, free to use.</p>'));
    } else {
      last.after(el("footer", { class: "site-foot" }, '<p><a href="' + ROOTP + 'index.html">← All 14 weeks</a></p><p>SMB31202 English for Technical Communication · Department of Languages &amp; General Studies, FPK, UniMAP · Semester 1, 2026/2027. Photos from Pexels and Unsplash, free to use.</p>'));
    }
  })();

  /* ---------- contents drawer ---------- */
  var tocList = $("#tocList");
  slides.forEach(function (s, i) {
    var t = s.getAttribute("data-title") || ($("h1, h2, h3", s) || {}).textContent || "Section " + (i + 1);
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

  /* ---------- scroll behaviour ---------- */
  var cur = 0;
  wk.total = slides.length;
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides[i].scrollIntoView({ behavior: "smooth", block: "start" });
    try { history.replaceState(null, "", "#" + (i + 1)); } catch (e) {}
  }
  function markCurrent(i) {
    if (i === cur && $$(".slide.is-active").length) return;
    cur = i;
    slides.forEach(function (s, j) { s.classList.toggle("is-active", j === i); });
    var secEl = $(".deck-top__sec");
    if (secEl) {
      var st = i === 0 ? "" : (slides[i].getAttribute("data-title") || "").replace(/^Part [A-Z0-9]+\s*[·:\-–]\s*/i, "");
      if (secEl.getAttribute("data-t") !== st) {
        secEl.classList.add("swap");
        setTimeout(function () { secEl.textContent = st; secEl.setAttribute("data-t", st); secEl.classList.remove("swap"); }, 180);
      }
    }
    $$("#tocList button").forEach(function (b, j) {
      b.classList.toggle("is-current", j === i);
      b.classList.toggle("is-seen", wk.seen.indexOf(j) >= 0);
    });
  }
  function updateProgress() { /* scroll progress lives in the global nav (lab.js) */ }

  if ("IntersectionObserver" in window) {
    // which section is on screen: mark seen, remember place, fire slide:enter
    var vis = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var i = slides.indexOf(en.target);
        if (en.isIntersecting && !vis[i]) {
          vis[i] = true;
          if (wk.seen.indexOf(i) < 0) wk.seen.push(i);
          wk.last = Math.max(wk.last || 0, i); save();
          en.target.dispatchEvent(new CustomEvent("slide:enter", { bubbles: true }));
        } else if (!en.isIntersecting) { vis[i] = false; }
      });
      var best = -1, bestRatio = 0;
      slides.forEach(function (s, j) {
        if (vis[j]) { var r = s.getBoundingClientRect(); var v = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0); if (v > bestRatio) { bestRatio = v; best = j; } }
      });
      if (best >= 0) markCurrent(best);
    }, { threshold: [0, 0.3] });
    slides.forEach(function (s) { io.observe(s); });

    // fade-up on scroll
    if (!STATIC) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); ro.unobserve(en.target); (function (t) { setTimeout(function () { t.style.transitionDelay = ""; }, 1700); })(en.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
      slides.forEach(function (s) {
        if (s.classList.contains("slide--part")) return;
        Array.prototype.forEach.call(s.children, function (c, k) {
          if (c.matches && c.matches(".grid, .flip-grid, .keystats, .weeks, .split")) {
            Array.prototype.forEach.call(c.children, function (g, n) { g.classList.add("reveal-on", "rv-pop"); g.style.transitionDelay = Math.min(n, 7) * 90 + "ms"; ro.observe(g); });
          } else {
            c.classList.add("reveal-on"); c.style.transitionDelay = Math.min(k, 3) * 70 + "ms"; ro.observe(c);
          }
        });
      });
    }
  } else {
    slides.forEach(function (s) { s.dispatchEvent(new CustomEvent("slide:enter", { bubbles: true })); });
  }

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key === "c" || e.key === "C") { toc.classList.contains("is-open") ? closeToc() : openToc(); }
    else if (e.key === "Escape") closeToc();
  });
  window.addEventListener("hashchange", function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (n) slides[Math.min(slides.length, n) - 1].scrollIntoView();
  });

  /* ---------- widgets ---------- */

  // Multiple choice: .quiz > .quiz__q + .quiz__opts > button[data-correct] (+ data-why)
  $$(".quiz").forEach(function (q) {
    var pts = +(q.getAttribute("data-xp") || 10);
    var id = widgetId("quiz");
    var chip = headFor(q, q.getAttribute("data-label") || "Quick check", id, pts);
    require(id, q.getAttribute("data-label") || "Quick check", q);
    var fb = $(".quiz__fb", q) || q.appendChild(el("p", { class: "quiz__fb" }));
    var btns = $$(".quiz__opts button", q);
    if (btns.filter(function (x) { return x.hasAttribute("data-correct"); }).length !== 1) console.warn("Quiz without exactly one data-correct:", q);
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
          if (window.Motion) window.Motion.burst(b);
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
    var id = widgetId("rev");
    require(id, "Check your answer", d);
    d.addEventListener("toggle", function () { if (d.open) { markDone(id); if (pts) award(id, pts); } });
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
  $$(".flip-grid").forEach(function (g) {
    var pts = +(g.getAttribute("data-xp") || 0); var id = widgetId("flip");
    var cards = $$(".flip", g), seen = {};
    if (!cards.length) return;
    require(id, "Flip all " + cards.length + " cards", g);
    cards.forEach(function (c, i) {
      c.addEventListener("click", function () { seen[i] = 1; if (Object.keys(seen).length === cards.length) { markDone(id); if (pts) award(id, pts); } });
    });
  });

  // Sorter: .sorter[data-xp] > .sorter__pool > .chip[data-bin] ; .sorter__bins > .bin[data-bin] (> .bin__label)
  $$(".sorter").forEach(function (s) {
    var pts = +(s.getAttribute("data-xp") || 15);
    var id = widgetId("sort");
    var chip = headFor(s, s.getAttribute("data-label") || "Sort it", id, pts);
    require(id, s.getAttribute("data-label") || "Sort it", s);
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
    require(id, g.getAttribute("data-label") || "Fill the gaps", g);
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
      markDone(id);
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
    var need = min || 20;
    require(id, (w.getAttribute("data-label") || "Write") + " (" + need + "+ words)", w, true);
    var ta = $("textarea", w) || w.appendChild(el("textarea"));
    if (!ta.getAttribute("aria-label")) ta.setAttribute("aria-label", "Your writing");
    if (max >= 150 || min >= 150) ta.style.minHeight = "20rem";
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
      if (n >= need) markDone(id);
    }
    ta.addEventListener("input", function () {
      upd(); clearTimeout(t);
      t = setTimeout(function () { store.drafts[key] = ta.value; save(); }, 400);
      if (LAB && WN) LAB.syncWriting("w" + WEEK, id, w.getAttribute("data-label") || "Write", ta.value);
    });
    upd();
  });

  // Checklist: ul.checklist > li (text)
  $$("ul.checklist").forEach(function (ul) {
    var pts = +(ul.getAttribute("data-xp") || 0);
    var id = widgetId("check");
    var items = $$("li", ul);
    require(id, "Tick the checklist", ul);
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
      if (done === items.length) { markDone(id); if (pts) award(id, pts); }
    }
    upd();
  });

  // Build steps: ol.steps[data-build] -> reveal one at a time
  $$("ol.steps[data-build]").forEach(function (ol) {
    var lis = $$(":scope > li", ol);
    var shown = 1;
    var sid = widgetId("steps"); require(sid, "Reveal all the steps", ol);
    ol.classList.add("is-building");
    var btn = el("button", { class: "btn btn--sm steps__btn", type: "button" }, "Reveal next ▸");
    ol.before(btn);
    function upd() {
      lis.forEach(function (li, i) { li.classList.toggle("is-hidden", i >= shown); });
      if (shown >= lis.length) { btn.textContent = "All shown ✓"; btn.disabled = true; markDone(sid); }
    }
    btn.addEventListener("click", function () { shown++; upd(); });
    upd();
  });

  // Tabs: .tabs > .tabs__bar > button[data-tab] ; .tabs__panel[data-panel]
  $$(".tabs").forEach(function (t) {
    var btns = $$(".tabs__bar button", t), panels = $$(".tabs__panel", t);
    t.querySelector(".tabs__bar").setAttribute("role", "tablist");
    var tid = widgetId("tabs"), viewed = {}; if (btns.length > 1) require(tid, "Open every tab", t);
    function show(name) {
      viewed[name] = 1; if (Object.keys(viewed).length >= btns.length) markDone(tid);
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
    var saved = store.drafts[key];
    inp.value = saved || Math.round((+min + +max) / 2);
    val.textContent = saved ? inp.value : "?";
    if (!saved) inp.style.opacity = "0.5";
    function upd() { inp.style.opacity = ""; val.textContent = inp.value; store.drafts[key] = inp.value; save(); }
    require(id, "Rate yourself", r);
    if (saved) markDone(id);
    inp.addEventListener("input", function () { upd(); markDone(id); });
  });

  // Random picker: .picker[data-items='["a","b"]'] (data-label)
  $$(".picker").forEach(function (p) {
    var items; try { items = JSON.parse(p.getAttribute("data-items")); } catch (e) { items = []; }
    p.innerHTML = '<div class="widget__head" style="justify-content:center"><span>' + (p.getAttribute("data-label") || "Random pick") + '</span></div><div class="picker__out">Press spin</div><button class="btn btn--primary btn--sm" type="button">🎲 Spin</button>';
    var out = $(".picker__out", p);
    var pid = widgetId("pick"); require(pid, p.getAttribute("data-label") || "Spin the picker", p);
    $("button", p).addEventListener("click", function () {
      markDone(pid);
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
    if (f) { renderFinale(f); if (!f.__cf && xpTotal() > 0) { f.__cf = 1; confetti(); } }
  });

  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var c = el("canvas", { style: "position:fixed;inset:0;pointer-events:none;z-index:100", "aria-hidden": "true" });
    document.body.appendChild(c);
    var ctx = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
    var cols = ["#0071e3", "#6e4ff6", "#d1307a", "#1a8f3c", "#ff9f0a"], ps = [];
    for (var i = 0; i < 140; i++) ps.push({ x: c.width / 2, y: c.height / 3, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 3, s: Math.random() * 6 + 3, c: cols[i % 5], r: Math.random() * 6 });
    var f = 0;
    (function loop() {
      ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach(function (p) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); });
      if (++f < 150) requestAnimationFrame(loop); else c.remove();
    })();
  }

  /* motion layer (parallax, text reveal, tilt, burst) */
  (function () {
    var me = document.currentScript || $$("script[src$='deck.js']")[0];
    if (!me || window.Motion) return;
    var m = document.createElement("script"); m.src = me.src.replace(/deck\.js(\?.*)?$/, "motion.js"); m.defer = true;
    document.head.appendChild(m);
  })();

  /* ---------- ETC Lab layer: wall, boss round, coach, mission rail ---------- */
  if (LAB) {
    // Class Wall for this week's board
    var wm = $("[data-wallmount]");
    if (wm) {
      var wallXp = "wall-post";
      require(wallXp, "Post on the Week " + WN + " wall", wm, true);
      new LAB.Wall({ board: "w" + WEEK, mount: wm, compact: true, onPosted: function () { award(wallXp, 15); } });
    }
    // Boss round from the page's own quizzes
    var bm = $("[data-bossmount]");
    if (bm) {
      var QS = $$(".quiz").map(function (q) {
        var qt = $(".quiz__q", q); var btns = $$(".quiz__opts button", q);
        var right = -1; btns.forEach(function (b, i) { if (b.hasAttribute("data-correct")) right = i; });
        if (!qt || btns.length < 2 || right < 0) return null;
        var rb = btns[right];
        return { q: qt.innerHTML, opts: btns.map(function (b) { return b.innerHTML; }), right: right, why: rb.getAttribute("data-why") || "" };
      }).filter(Boolean);
      if (QS.length >= 4) {
        require("boss", "Play the boss round", bm, true);
        LAB.boss(bm, QS, { xp: 40, blurb: HOOK ? HOOK.boss : "", onDone: function (score, n, xp) { markDone("boss"); if (xp > 0) { var id = "boss"; if (!wk.earned[id] || wk.earned[id] < xp) { wk.earned[id] = xp; save(); renderXP(true); showToast("+" + xp + " XP"); } } } });
      } else {
        bm.innerHTML = '<p class="eyebrow">Boss round</p><h2 class="lbig">No quiz this week.<br><span class="muted">Assessment weeks are about the real thing.</span></h2><p class="lede">Use the Class Wall above, then open the Contents drawer to revise the weeks the test covers.</p>';
      }
    }
    // AI coach on substantial writing pads
    $$(".write").forEach(function (w) {
      var min = +(w.getAttribute("data-min") || 0), max = +(w.getAttribute("data-max") || 0);
      if (Math.max(min, max) < 30) return;
      var task = (w.getAttribute("data-label") || "") + ". " + ($(".small, p", w) ? $(".small, p", w).textContent.trim() : "");
      var cid = "coach" + ($$(".write").indexOf(w) + 1);
      LAB.coach(w, { task: task.slice(0, 500), week: WEEK, title: TITLE, min: min, max: max, onFeedback: function () { award(cid, 10); } });
    });
    // speaker buttons on model sentences; listening lab
    LAB.addSpeakers(document);
    var lm = $("[data-listenmount]");
    if (lm) { var seen = {}; var uniq = SENT.filter(function (t) { if (seen[t]) return false; seen[t] = 1; return true; }); var pick = uniq.length > 3 ? [uniq[0], uniq[Math.floor(uniq.length / 2)], uniq[uniq.length - 1]] : uniq; LAB.listeningLab(lm, pick, { onDone: function () { award("dictation", 15); }, onRecord: function () { award("record", 10); } }); }
    // mission rail: which stage is on screen
    var stages = ["hook", "learn", "try", "wall", "boss"];
    var railLinks = $$(".rail a");
    function railTick() {
      var y = window.scrollY + innerHeight * 0.35, cur = -1;
      stages.forEach(function (id, i) { var e = document.getElementById(id); if (e && e.getBoundingClientRect().top + window.scrollY <= y) cur = i; });
      railLinks.forEach(function (a, i) { a.classList.toggle("now", i === cur); a.classList.toggle("done", i < cur); });
      var tryDone = Object.keys(wk.earned).length > 0; if (tryDone && railLinks[2]) railLinks[2].classList.add("done");
    }
    window.addEventListener("scroll", function () { requestAnimationFrame(railTick); }, { passive: true });
    railLinks.forEach(function (a) { a.addEventListener("click", function (e) { var t = document.getElementById(a.getAttribute("href").slice(1)); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth", block: "start" }); } }); });
    railTick();
    /* ---------- mission HUD: every activity + full scroll, then attendance ---------- */
    if (WN) {
      LAB.presence("w" + WEEK);
      var hud = el("div", { class: "hud-m", id: "hudm" }, '<button class="hud-m__pill" type="button" aria-expanded="false" aria-controls="hudPanel"><span class="hud-m__ring"><i></i></span><span class="hud-m__txt">Mission</span></button><div class="hud-m__panel" id="hudPanel" hidden></div>');
      body.appendChild(hud);
      var pill = $(".hud-m__pill", hud), panel = $("#hudPanel", hud), ring = $(".hud-m__ring i", hud), txt = $(".hud-m__txt", hud);
      function scrollPct() { var h = document.documentElement; var max = h.scrollHeight - h.clientHeight; if (max <= 0) return 100; var p = Math.min(100, Math.round(window.scrollY / max * 100)); var fin = $(".finale"); if (p >= 95 && fin && fin.getBoundingClientRect().top > h.clientHeight) p = 94; return p; }
      /* "looked at": a section counts once it has filled most of the screen for about 1.5 s */
      var VIEW = slides.filter(function (x) { return !$(".finale", x) && !x.classList.contains("slide--title") && x.offsetHeight > 0; }).concat($$("#hook"));
      function vkey(x) { return x.id || x.getAttribute("data-title") || String(slides.indexOf(x)); }
      var dwell = {};
      setInterval(function () {
        if (document.hidden) return;
        var vh = innerHeight, changed = false;
        VIEW.forEach(function (x) {
          var k = vkey(x); if (wk.viewed[k]) return;
          var r = x.getBoundingClientRect(); var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
          if (vis <= 0) return;
          if (vis / Math.max(1, Math.min(r.height, vh)) >= 0.6) { dwell[k] = (dwell[k] || 0) + 0.5; if (dwell[k] >= 1.5) { wk.viewed[k] = 1; changed = true; } }
        });
        if (changed) { save(); renderHud(); }
      }, 500);
      function viewedPct() { var n = VIEW.filter(function (x) { return wk.viewed[vkey(x)]; }).length; return VIEW.length ? Math.round(n / VIEW.length * 100) : 100; }
      function missionState() {
        var core = REQ.filter(function (r) { return r.core; }), light = REQ.filter(function (r) { return !r.core; });
        var isDone = function (r) { return !!wk.done[r.id]; };
        var coreDone = core.filter(isDone).length, lightDone = light.filter(isDone).length;
        var lightNeed = Math.ceil(light.length * LIGHT_SHARE);
        var need = core.length + lightNeed;
        var prog = coreDone + Math.min(lightDone, lightNeed);
        var coreMissing = core.filter(function (r) { return !isDone(r); });
        var lightMissing = light.filter(function (r) { return !isDone(r); });
        var unseen = VIEW.filter(function (x) { return !wk.viewed[vkey(x)]; });
        var sc = viewedPct();
        var complete = coreMissing.length === 0 && lightDone >= lightNeed && unseen.length === 0;
        return { done: coreDone + lightDone, total: REQ.length, need: need, prog: prog, coreDone: coreDone, coreTotal: core.length, lightDone: lightDone, lightTotal: light.length, lightNeed: lightNeed, lightLeft: Math.max(0, lightNeed - lightDone), coreMissing: coreMissing, lightMissing: lightMissing, unseen: unseen, scroll: sc, complete: complete };
      }
      function renderHud() {
        var st = missionState();
        var pct = st.need ? Math.round((st.prog / st.need) * 90 + Math.min(10, st.scroll / 10)) : st.scroll;
        ring.style.setProperty("--p", pct);
        hud.classList.toggle("is-complete", st.complete);
        hud.classList.toggle("is-attended", !!wk.attended);
        txt.textContent = wk.attended ? "Attended ✓" : st.complete ? "Record attendance" : st.prog + "/" + st.need + " · " + st.scroll + "%";
        pill.setAttribute("aria-label", wk.attended ? "Attendance recorded" : st.prog + " of " + st.need + " activities needed, " + st.scroll + " percent of sections read. Open the mission list.");
        if (!panel.hidden) renderPanel(st);
      }
      function renderPanel(st) {
        panel.innerHTML = '<div class="hud-m__head"><strong>Week ' + WN + ' mission</strong><span class="small muted">' + st.done + " of " + st.total + " activities done · " + (VIEW.length - st.unseen.length) + " of " + VIEW.length + " sections read</span></div>" +
          (wk.attended ? '<div class="hud-m__ok">Attendance recorded · ' + fmtTs(wk.attended.ts) + "<br><span class=\"small\">" + LAB.esc(wk.attended.name || "") + "</span></div>" :
           st.complete ? '<p class="small">Unlocked. Record your attendance for this week.' + (st.done < st.total ? ' You can still finish the other ' + (st.total - st.done) + " activities for XP." : "") + '</p><button class="lbtn" type="button" data-attend>Record my attendance</button>' :
           '<p class="small muted" style="margin:0 0 6px">To unlock attendance:</p><ul class="hud-m__list">' +
             st.coreMissing.map(function (r, i) { return '<li><button type="button" class="must" data-goto="c' + i + '"><b>Must</b> ' + LAB.esc(r.label) + "</button></li>"; }).join("") +
             (st.lightLeft ? '<li class="hud-m__sub">Any ' + st.lightLeft + " more of these small activities (" + st.lightDone + " of " + st.lightNeed + " needed):</li>" + st.lightMissing.slice(0, 10).map(function (r, i) { return '<li><button type="button" data-goto="l' + i + '">' + LAB.esc(r.label) + "</button></li>"; }).join("") + (st.lightMissing.length > 10 ? "<li class=\"muted small\">+" + (st.lightMissing.length - 10) + " more to choose from</li>" : "") : "") +
             st.unseen.slice(0, 8).map(function (x, i) { return '<li><button type="button" class="read" data-read="' + i + '">Read: ' + LAB.esc((x.getAttribute("data-title") || (x.id === "hook" ? "Hook" : "Section")).replace(/^Part [A-Z0-9]+\s*[·:\-–]\s*/i, "")) + "</button></li>"; }).join("") + (st.unseen.length > 8 ? "<li class=\"muted small\">+" + (st.unseen.length - 8) + " more sections to read</li>" : "") + "</ul>") +
          '<p class="small muted" style="margin:8px 0 0">' + (LAB.identity() ? "Signed in as " + LAB.esc(LAB.identity().name) + ' · <a href="#" data-whoami>change</a>' : '<a href="#" data-whoami>Enter your matric number</a> so your lecturer sees your name.') + "</p>";
        $$("[data-goto]", panel).forEach(function (b) { b.addEventListener("click", function () { var g = b.getAttribute("data-goto"); var r = (g.charAt(0) === "c" ? st.coreMissing : st.lightMissing)[+g.slice(1)]; if (r && r.el) { r.el.scrollIntoView({ behavior: "smooth", block: "center" }); r.el.classList.add("hud-flash"); setTimeout(function () { r.el.classList.remove("hud-flash"); }, 1600); } }); });
        $$("[data-read]", panel).forEach(function (b) { b.addEventListener("click", function () { var x = st.unseen[+b.getAttribute("data-read")]; if (x) x.scrollIntoView({ behavior: "smooth", block: "start" }); }); });
        var at = $("[data-attend]", panel); if (at) at.addEventListener("click", doAttend);
        var wi = $("[data-whoami]", panel); if (wi) wi.addEventListener("click", function (e) { e.preventDefault(); LAB.askIdentity({ optional: true, prefill: LAB.identity() ? LAB.identity().matric : "" }).then(function () { renderHud(); }); });
      }
      function fmtTs(ts) { var d = new Date(ts + 8 * 3600000); var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return d.getUTCDate() + " " + M[d.getUTCMonth()] + ", " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); }
      function doAttend() {
        var st = missionState();
        if (!st.complete) { showToast("Not yet. Open the mission list to see what is left."); return; }
        var go = function (idn) {
          if (!idn) return;
          var summary = { xp: xpTotal(), done: st.done, total: st.total, coreDone: st.coreDone, coreTotal: st.coreTotal, lightDone: st.lightDone, lightTotal: st.lightTotal, scroll: st.scroll, missing: [] };
          LAB.attend("w" + WEEK, idn.matric, summary, idn).then(function (d) {
            wk.attended = { ts: d.ts, name: d.name, matric: idn.matric }; save(); renderHud();
            showToast(d.already ? "Already recorded for this week." : (d.manual ? "Recorded as a manual entry. Your lecturer will check it." : "Attendance recorded. Nice work."));
            if (!d.already) confetti();
          }).catch(function (e) { showToast(e.message === "offline" ? "Attendance works on the class website, not on this copy." : e.message); });
        };
        var idn = LAB.identity();
        if (idn) {
          var m = document.createElement("div"); m.className = "lmodal";
          m.innerHTML = '<div class="lmodal__bg"></div><div class="lmodal__card"><p class="eyebrow">Attendance · Week ' + WN + '</p><h3>Record attendance as</h3><p style="margin:0"><b>' + LAB.esc(idn.name) + "</b><br><span class=\"muted\">" + LAB.esc(idn.matric) + " · " + LAB.esc(idn.section) + (idn.manual ? " · manual entry, your lecturer will check it" : "") + '</span></p><div class="lchips"><button class="lbtn" type="button" data-yes>Yes, record it</button><button class="lchip" type="button" data-change>Not me, change</button></div></div>';
          body.appendChild(m);
          $("[data-yes]", m).addEventListener("click", function () { m.remove(); go(idn); });
          $("[data-change]", m).addEventListener("click", function () { m.remove(); LAB.askIdentity({ eyebrow: "Attendance · Week " + WN, title: "Enter your matric number" }).then(go); });
        } else {
          LAB.askIdentity({ eyebrow: "Attendance · Week " + WN, title: "Enter your matric number", text: "Your attendance for this week is recorded against your matric number." }).then(go);
        }
      }
      pill.addEventListener("click", function () { if (!panel.hidden) { panel.hidden = true; pill.setAttribute("aria-expanded", "false"); return; } panel.hidden = false; pill.setAttribute("aria-expanded", "true"); renderPanel(missionState()); });
      var scT;
      window.addEventListener("scroll", function () { var p = scrollPct(); if (p > (wk.scroll || 0)) { wk.scroll = p; clearTimeout(scT); scT = setTimeout(function () { save(); renderHud(); }, 300); } }, { passive: true });
      /* keep the pill off the content: slide it away while scrolling down, back on scroll up, at the end of the page, or when progress ticks */
      var lastY = window.scrollY, peekT;
      function hudShow(ms) { hud.classList.remove("is-away"); clearTimeout(peekT); if (ms) peekT = setTimeout(function () { peekT = 0; }, ms); }
      window.addEventListener("scroll", function () {
        var y = window.scrollY, dy = y - lastY; if (Math.abs(dy) < 6) return; lastY = y;
        var nearEnd = innerHeight + y >= document.documentElement.scrollHeight - 160;
        if (!panel.hidden || nearEnd || dy < 0) hudShow(); else if (!peekT) hud.classList.add("is-away");
      }, { passive: true });
      window.__missionTick = function () { renderHud(); hudShow(2500); };
      renderHud();
      // first visit on this device: ask who they are (optional, can skip)
      if (!LAB.identity() && !store.askedId) { store.askedId = 1; save(); setTimeout(function () { LAB.askIdentity({ optional: true }).then(function () { renderHud(); }); }, 2500); }
    }

    LAB.setupMotion(document);
    main.classList.add("enter");
  }

  /* expose a tiny API for week-specific scripts */
  window.Deck = { award: award, widgetId: widgetId, go: go, toast: showToast, week: WEEK };

  /* ---------- start ---------- */
  renderXP(false);
  updateProgress();
  markCurrent(0);
  var startN = parseInt(location.hash.slice(1), 10);
  if (startN) {
    setTimeout(function () { slides[Math.min(slides.length, startN) - 1].scrollIntoView(); }, 60);
  } else if (wk.last > 2 && wk.last < slides.length - 1) {
    var rb = el("button", { class: "btn btn--dark btn--sm", type: "button", style: "position:fixed;right:16px;bottom:16px;z-index:85;box-shadow:0 8px 24px rgba(0,0,0,.2)" }, "Continue where you left off ↓");
    rb.addEventListener("click", function () { go(wk.last); rb.remove(); });
    body.appendChild(rb);
    setTimeout(function () { rb.remove(); }, 12000);
  }
})();
