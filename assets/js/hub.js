/* Course home page: tiles, charts, timeline, week cards and progress */
(function () {
  "use strict";
  var C = window.COURSE;
  function $(s) { return document.querySelector(s); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function d(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmt(s) { var x = d(s); return x.getDate() + " " + MON[x.getMonth()]; }
  var MODE = { on: ["Online", "tag"], f2f: ["Face-to-face", "tag tag--lime"], test: ["Assessment", "tag tag--red"], off: ["Break", "tag tag--violet"] };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";

  /* progress from the lesson engine's storage */
  var store = { weeks: {} };
  try { store = JSON.parse(localStorage.getItem("smb31202.progress.v1")) || store; } catch (e) {}
  function prog(n) {
    var w = store.weeks && store.weeks[pad(n)];
    if (!w) return { pct: 0, xp: 0, seen: 0, total: 0 };
    var xp = 0; for (var k in (w.earned || {})) xp += w.earned[k];
    var total = w.total || 0, seen = (w.seen || []).length;
    return { pct: total ? Math.min(100, Math.round(seen / total * 100)) : 0, xp: xp, seen: seen, total: total };
  }

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var nowIdx = -1;
  C.weeks.forEach(function (w, i) { if (today >= d(w.start) && today <= d(w.end)) nowIdx = i; });

  /* ---------- tiles ---------- */
  var totalXp = 0, done = 0, resume = null;
  C.weeks.forEach(function (w) {
    if (typeof w.n !== "number") return;
    var p = prog(w.n); totalXp += p.xp;
    if (p.pct >= 90) done++;
    if (p.seen && p.pct < 90 && !resume) resume = w;
  });
  $("#totalXp").textContent = totalXp;
  $("#bigXp").textContent = totalXp;
  $("#myProg").innerHTML = done + '<span style="font-size:1.6rem;color:var(--dim)">/14</span>';
  var ranks = [[0, "Cadet"], [100, "Apprentice Communicator"], [300, "Technical Writer"], [600, "Senior Engineer"], [1000, "Chief Communicator"]];
  var ri = 0; ranks.forEach(function (r, i) { if (totalXp >= r[0]) ri = i; });
  $("#myRank").textContent = ranks[ri][1];
  $("#rankNext").textContent = ranks[ri + 1] ? (ranks[ri + 1][0] - totalXp) + " XP to " + ranks[ri + 1][1] : "Top rank reached";

  var showIdx = nowIdx >= 0 ? nowIdx : (today < d(C.weeks[0].start) ? 0 : C.weeks.length - 4);
  var sw = C.weeks[showIdx];
  $("#tileNow").style.backgroundImage = "url(assets/img/" + (sw.img || "team-casual") + ".jpg)";
  if (nowIdx >= 0) {
    $("#nowWeek").textContent = typeof sw.n === "number" ? "Week " + sw.n : sw.title;
    $("#nowTitle").textContent = typeof sw.n === "number" ? sw.title : fmt(sw.start) + " – " + fmt(sw.end);
  } else if (today < d(C.weeks[0].start)) {
    $("#nowWeek").textContent = "Starts soon"; $("#nowTitle").textContent = "Week 1 begins " + fmt(C.weeks[0].start) + " 2026";
  } else {
    $("#nowWeek").textContent = "Semester complete"; $("#nowTitle").textContent = "No final exam for SMB31202. Well done!";
  }
  if (typeof sw.n === "number") $("#nowLink").href = "weeks/week-" + pad(sw.n) + ".html";

  var next = null;
  C.assessments.forEach(function (a) { if (!next && d(a.start) >= today) next = a; });
  if (next) {
    var days = Math.round((d(next.start) - today) / 86400000);
    $("#nextDays").innerHTML = days + '<span style="font-size:1.4rem;color:var(--dim)"> days</span>';
    $("#nextName").textContent = next.name + " · " + next.pct + "%";
    $("#nextWhen").textContent = next.when;
  } else { $("#nextDays").textContent = "✓"; $("#nextName").textContent = "All assessments done"; }

  /* main CTA: resume, else current week, else week 1 */
  var cta = $("#ctaMain");
  if (resume) { cta.href = "weeks/week-" + pad(resume.n) + ".html"; cta.textContent = "Continue Week " + resume.n; }
  else if (nowIdx >= 0 && typeof C.weeks[nowIdx].n === "number") { cta.href = "weeks/week-" + pad(C.weeks[nowIdx].n) + ".html"; cta.textContent = "Open Week " + C.weeks[nowIdx].n; }

  /* typed tagline */
  var lines = ["Read charts like an engineer.", "Write reports that get approved.", "Speak up and lead the discussion.", "Fourteen weeks. Made to be read."];
  var tEl = $("#typed"), li = 0, ci = 0, del = false;
  if (reduce) tEl.textContent = lines[0];
  else (function type() {
    var s = lines[li];
    tEl.textContent = s.slice(0, ci);
    if (!del && ci < s.length) { ci++; setTimeout(type, 45); }
    else if (!del) { del = true; setTimeout(type, 1800); }
    else if (ci > 0) { ci--; setTimeout(type, 18); }
    else { del = false; li = (li + 1) % lines.length; setTimeout(type, 250); }
  })();

  /* ---------- assessments: donut + cards ---------- */
  var colors = { cyan: "#0071e3", violet: "#6e4ff6", pink: "#d1307a", lime: "#1a8f3c" };
  $("#assessGrid").innerHTML = C.assessments.map(function (a) {
    var dd = Math.round((d(a.start) - today) / 86400000);
    var count = dd > 0 ? dd + " days to go" : (dd > -7 ? "This week" : "Completed");
    return '<div class="assess assess--' + a.color + '"><div class="assess__pct">' + a.pct + '<span style="font-size:1.2rem">%</span></div><h3>' + a.name + '</h3><div class="assess__when">' + a.when + "</div><p>" + a.detail + '</p><div class="assess__count">' + count + "</div></div>";
  }).join("");

  var donut = $("#donut"), R = 74, CIRC = 2 * Math.PI * R, off = 0, segs = [];
  var h = '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="#e3e3e8" stroke-width="22"/>';
  C.assessments.forEach(function (a, i) {
    var len = CIRC * a.pct / 100 - 3;
    h += '<circle class="seg" cx="100" cy="100" r="' + R + '" fill="none" stroke="' + colors[a.color] + '" stroke-width="22" stroke-linecap="butt" stroke-dasharray="0 ' + CIRC + '" data-len="' + len + '" data-circ="' + CIRC + '" transform="rotate(' + (-90 + off * 3.6) + ' 100 100)" style="transition:stroke-dasharray 1.1s cubic-bezier(.2,.7,.2,1) ' + (i * 0.15) + 's"><title>' + a.name + " " + a.pct + '%</title></circle>';
    off += a.pct;
  });
  h += '<text x="100" y="98" text-anchor="middle" font-size="34" font-weight="800" fill="#1d1d1f" letter-spacing="-1">100</text><text x="100" y="118" text-anchor="middle" font-size="11" fill="#6e6e73">marks in total</text>';
  donut.innerHTML = h;

  /* cumulative marks step chart */
  (function () {
    var W = 640, H = 270, L = 44, Rr = 20, T = 50, B = 44;
    function x(w) { return L + (w - 1) / 13 * (W - L - Rr); }
    function y(v) { return T + (1 - v / 100) * (H - T - B); }
    var pts = [[1, 0], [8, 0], [8, 30], [10, 30], [10, 50], [12, 50], [12, 70], [14, 70], [14, 100]];
    var path = "M" + pts.map(function (p) { return x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1); }).join(" L");
    var s = '<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0071e3" stop-opacity=".22"/><stop offset="1" stop-color="#0071e3" stop-opacity="0"/></linearGradient></defs>';
    [0, 25, 50, 75, 100].forEach(function (v) { s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e3e3e8"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#86868b">' + v + "</text>"; });
    for (var w = 1; w <= 14; w++) s += '<text x="' + x(w) + '" y="' + (H - B + 18) + '" text-anchor="middle" font-size="11" fill="#86868b">' + w + "</text>";
    s += '<text x="' + ((L + W - Rr) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="#6e6e73">Teaching week</text>';
    s += '<path d="' + path + ' L' + x(14) + " " + y(0) + " L" + x(1) + " " + y(0) + ' Z" fill="url(#area)"/>';
    s += '<path id="stepline" d="' + path + '" fill="none" stroke="#0071e3" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>';
    [[8, 30, "Reading Test", "+30"], [10, 50, "Writing Test", "+20"], [12, 70, "Poster due", "+20"], [14, 100, "Speaking", "+30"]].forEach(function (m) {
      var anchor = m[0] === 14 ? "end" : "middle", dx = m[0] === 14 ? -6 : 0;
      s += '<circle cx="' + x(m[0]) + '" cy="' + y(m[1]) + '" r="6" fill="#fff" stroke="#0071e3" stroke-width="3"/><text x="' + (x(m[0]) + dx) + '" y="' + (y(m[1]) - 22) + '" text-anchor="' + anchor + '" class="lbl-strong">' + m[2] + '</text><text x="' + (x(m[0]) + dx) + '" y="' + (y(m[1]) - 9) + '" text-anchor="' + anchor + '" style="fill:#1a8f3c;font-weight:600">' + m[3] + " → " + m[1] + "</text>";
    });
    $("#steps").innerHTML = s;
    var line = $("#stepline"), len = line.getTotalLength();
    line.style.strokeDasharray = len; line.style.strokeDashoffset = reduce ? 0 : len;
    line.style.transition = "stroke-dashoffset 2s cubic-bezier(.2,.7,.2,1)";
    $("#steps").__len = len;
  })();

  /* draw charts when scrolled into view */
  function drawDonut() { Array.prototype.forEach.call(document.querySelectorAll("#donut .seg"), function (c) { c.setAttribute("stroke-dasharray", c.getAttribute("data-len") + " " + c.getAttribute("data-circ")); }); }
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        if (e.target.id === "donut") drawDonut();
        if (e.target.id === "steps") $("#stepline").style.strokeDashoffset = 0;
        io.unobserve(e.target);
      });
    }, { threshold: 0.35 });
    io.observe($("#donut")); io.observe($("#steps"));
  } else { drawDonut(); $("#stepline").style.strokeDashoffset = 0; }

  /* ---------- timeline ---------- */
  $("#tl").innerHTML = C.weeks.map(function (w, i) {
    var label = typeof w.n === "number" ? "W" + w.n : "Break";
    var m = { on: "ONLINE", f2f: "F2F", test: "TEST", off: "OFF" }[w.mode];
    var href = typeof w.n === "number" ? "weeks/week-" + pad(w.n) + ".html" : "#weeks";
    return '<a class="tl tl--' + w.mode + (i === nowIdx ? " is-now" : "") + '" href="' + href + '" title="' + w.title + '"><span class="tl__w">' + label + '</span><span class="tl__m">' + m + '</span><span class="tl__d">' + fmt(w.start) + "</span></a>";
  }).join("");

  /* ---------- week cards ---------- */
  function renderWeeks(filter) {
    $("#weekGrid").innerHTML = C.weeks.filter(function (w) {
      return filter === "all" || w.mode === filter;
    }).map(function (w) {
      var i = C.weeks.indexOf(w), md = MODE[w.mode];
      var tags = '<span class="' + md[1] + '">' + md[0] + "</span>" + (w.flag ? '<span class="tag tag--amber">' + w.flag + "</span>" : "");
      var topics = "<ul>" + w.topics.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
      var img = '<img class="wk__img" src="assets/img/' + (w.img || "team-casual") + '.jpg" alt="" loading="lazy" width="1200" height="521">';
      if (typeof w.n !== "number") {
        return '<div class="wk wk--off">' + img + '<div class="wk__body"><div class="wk__issue">Mid-semester break</div><h3>' + w.title + '</h3><div class="wk__dates">' + fmt(w.start) + " – " + fmt(w.end) + "</div>" + topics + "</div></div>";
      }
      var p = prog(w.n);
      var stat = p.seen ? p.seen + " of " + p.total + " sections · " + p.xp + " XP" : "Not started";
      return '<a class="wk' + (i === nowIdx ? " is-now" : "") + '" href="weeks/week-' + pad(w.n) + '.html">' + img + '<div class="wk__body"><div class="wk__issue">Issue ' + pad(w.n) + (i === nowIdx ? ' <span class="tag">This week</span>' : "") + '</div><h3>' + w.title + '</h3><div class="wk__tags">' + tags + '</div><div class="wk__dates">' + fmt(w.start) + " – " + fmt(w.end) + "</div>" + topics +
        '<div class="wk__foot"><div class="ring" style="--p:' + p.pct + '" data-label="' + p.pct + '%"></div><div class="wk__stat">' + stat + '</div><span class="wk__go">' + (p.seen ? "Resume ›" : "Read ›") + "</span></div></div></a>";
    }).join("");
  }
  renderWeeks("all");
  Array.prototype.forEach.call(document.querySelectorAll("#filters button"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("#filters button"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderWeeks(b.getAttribute("data-f")); revealWeeks();
    });
  });

  /* ---------- motion: reveal on scroll, count-up numbers ---------- */
  var STATIC = /[?&]static\b/.test(location.search), still = reduce || STATIC;
  var rvIO = ("IntersectionObserver" in window && !still) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in"); rvIO.unobserve(e.target);
      (function (t) { setTimeout(function () { t.style.transitionDelay = ""; }, 1700); })(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }) : null;
  function reveal(list, pop) {
    if (!rvIO) return;
    Array.prototype.forEach.call(list, function (el, i) {
      if (el.classList.contains("reveal-on")) return;
      el.classList.add("reveal-on"); if (pop) el.classList.add("rv-pop");
      el.style.transitionDelay = Math.min(i, 7) * 80 + "ms"; rvIO.observe(el);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".section__head, .assess-layout > figure, .chart-card, .legend, .timeline, .footer .wrap"), function (el, i) { reveal([el], false); });
  reveal(document.querySelectorAll(".bento > .tile, .assess-layout .assess, .tip-grid .card"), true);
  function revealWeeks() { reveal(document.querySelectorAll("#weekGrid > .wk"), true); if (window.Motion) window.Motion.tilt(); }
  revealWeeks();

  function countUp(el) {
    var m = /^(\d+)/.exec(el.textContent); if (!m || still) return;
    var end = +m[1], rest = el.innerHTML.slice(m[1].length), t0 = null;
    if (end === 0) return;
    function step(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / 1300), e = 1 - Math.pow(1 - k, 3); el.innerHTML = Math.round(end * e) + rest; if (k < 1) requestAnimationFrame(step); }
    el.innerHTML = "0" + rest;
    var go = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { go.disconnect(); requestAnimationFrame(step); } }, { threshold: 0.6 });
    go.observe(el);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".big-num"), countUp);

  $("#teamLine").innerHTML = "<strong>Course coordinator:</strong> " + C.team.coordinator + " · <strong>Lecturers:</strong> " + C.team.lecturers.join(" · ");
  $("#resetBtn").addEventListener("click", function () {
    if (!confirm("Clear all your saved progress, XP, ticks and drafts in this browser?")) return;
    try { localStorage.removeItem("smb31202.progress.v1"); } catch (e) {}
    location.reload();
  });
})();
