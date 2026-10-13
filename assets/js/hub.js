/* Course home page: renders assessments, timeline, week cards and progress */
(function () {
  "use strict";
  var C = window.COURSE;
  function $(s) { return document.querySelector(s); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function d(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmt(s) { var x = d(s); return x.getDate() + " " + MON[x.getMonth()]; }
  var MODE = { on: ["Online", "tag"], f2f: ["Face-to-face", "tag tag--lime"], test: ["Assessment", "tag tag--red"], off: ["Break", "tag tag--violet"] };

  /* progress from the deck engine's storage */
  var store = { weeks: {} };
  try { store = JSON.parse(localStorage.getItem("smb31202.progress.v1")) || store; } catch (e) {}
  function prog(n) {
    var w = store.weeks && store.weeks[pad(n)];
    if (!w) return { pct: 0, xp: 0, seen: 0, total: 0 };
    var xp = 0; for (var k in (w.earned || {})) xp += w.earned[k];
    var total = w.total || 0, seen = (w.seen || []).length;
    return { pct: total ? Math.round(seen / total * 100) : 0, xp: xp, seen: seen, total: total };
  }

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var nowIdx = -1;
  C.weeks.forEach(function (w, i) { if (today >= d(w.start) && today <= d(w.end)) nowIdx = i; });

  /* hero status */
  var totalXp = 0, done = 0, started = 0, resume = null;
  C.weeks.forEach(function (w) {
    if (typeof w.n !== "number") return;
    var p = prog(w.n); totalXp += p.xp;
    if (p.pct >= 90) done++;
    if (p.seen) { started++; if (p.pct < 90 && !resume) resume = w; }
  });
  $("#totalXp").textContent = totalXp;
  $("#myProg").textContent = done + " / 14 weeks";
  var ranks = [[0, "Cadet"], [100, "Apprentice Communicator"], [300, "Technical Writer"], [600, "Senior Engineer"], [1000, "Chief Communicator"]];
  var rank = ranks[0][1]; ranks.forEach(function (r) { if (totalXp >= r[0]) rank = r[1]; });
  $("#myRank").textContent = "Rank: " + rank + " · " + totalXp + " XP";

  if (nowIdx >= 0) {
    var nw = C.weeks[nowIdx];
    $("#nowWeek").textContent = typeof nw.n === "number" ? "Week " + nw.n : nw.title;
    $("#nowTitle").textContent = typeof nw.n === "number" ? nw.title : fmt(nw.start) + " – " + fmt(nw.end);
  } else if (today < d(C.weeks[0].start)) {
    $("#nowWeek").textContent = "Starts soon"; $("#nowTitle").textContent = "Week 1 begins " + fmt(C.weeks[0].start) + " 2026";
  } else {
    $("#nowWeek").textContent = "Semester done"; $("#nowTitle").textContent = "No final exam for SMB31202. Well done!";
  }

  var next = null;
  C.assessments.forEach(function (a) { if (!next && d(a.start) >= today) next = a; });
  if (next) {
    var days = Math.round((d(next.start) - today) / 86400000);
    $("#nextName").textContent = next.name + " · " + next.pct + "%";
    $("#nextWhen").textContent = (days === 0 ? "This week" : "in " + days + " day" + (days === 1 ? "" : "s")) + " · " + next.when;
  } else { $("#nextName").textContent = "All done"; }

  /* main CTA: resume, else current week, else week 1 */
  var cta = $("#ctaMain");
  if (resume) { cta.href = "weeks/week-" + pad(resume.n) + ".html"; cta.textContent = "▶ Continue Week " + resume.n; }
  else if (nowIdx >= 0 && typeof C.weeks[nowIdx].n === "number") { cta.href = "weeks/week-" + pad(C.weeks[nowIdx].n) + ".html"; cta.textContent = "▶ Go to this week (Week " + C.weeks[nowIdx].n + ")"; }

  /* typed tagline */
  var lines = ["Read charts like an engineer.", "Write reports that get approved.", "Speak up and lead the discussion.", "14 weeks. Interactive. Built for you."];
  var tEl = $("#typed"), li = 0, ci = 0, del = false;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) tEl.textContent = lines.join(" ");
  else (function type() {
    var s = lines[li];
    tEl.textContent = s.slice(0, ci);
    if (!del && ci < s.length) { ci++; setTimeout(type, 45); }
    else if (!del) { del = true; setTimeout(type, 1800); }
    else if (ci > 0) { ci--; setTimeout(type, 18); }
    else { del = false; li = (li + 1) % lines.length; setTimeout(type, 250); }
  })();

  /* assessments */
  var colors = { cyan: "var(--cyan)", violet: "var(--violet)", pink: "var(--pink)", lime: "var(--lime)" };
  $("#weightBar").innerHTML = C.assessments.map(function (a) { return '<span style="width:' + a.pct + '%;background:' + colors[a.color] + '"></span>'; }).join("");
  $("#assessGrid").innerHTML = C.assessments.map(function (a) {
    var days = Math.round((d(a.start) - today) / 86400000);
    var count = days > 0 ? days + " days to go" : (days > -7 ? "This week" : "Completed");
    return '<div class="card assess assess--' + a.color + '"><div class="assess__pct">' + a.pct + '<span style="font-size:1.4rem">%</span></div><h3>' + a.name + '</h3><div class="assess__when">' + a.when + "</div><p>" + a.detail + '</p><div class="assess__count">⏱ ' + count + "</div></div>";
  }).join("");

  /* timeline */
  $("#tl").innerHTML = C.weeks.map(function (w, i) {
    var label = typeof w.n === "number" ? "W" + w.n : "Break";
    var m = { on: "ON", f2f: "F2F", test: "TEST", off: "OFF" }[w.mode];
    var href = typeof w.n === "number" ? "weeks/week-" + pad(w.n) + ".html" : "#weeks";
    return '<a class="tl tl--' + w.mode + (i === nowIdx ? " is-now" : "") + '" href="' + href + '" title="' + w.title + '"><span class="tl__w">' + label + '</span><span class="tl__m">' + m + '</span><span class="tl__d">' + fmt(w.start) + "</span></a>";
  }).join("");

  /* week cards */
  function renderWeeks(filter) {
    $("#weekGrid").innerHTML = C.weeks.filter(function (w) {
      return filter === "all" || w.mode === filter;
    }).map(function (w) {
      var i = C.weeks.indexOf(w);
      var md = MODE[w.mode];
      var tags = '<span class="' + md[1] + '">' + md[0] + "</span>" + (w.flag ? '<span class="tag tag--amber">' + w.flag + "</span>" : "");
      var topics = "<ul>" + w.topics.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
      if (typeof w.n !== "number") {
        return '<div class="wk wk--off"><div class="wk__top"><div class="wk__num">☕</div><div class="wk__tags">' + tags + "</div></div><h3>" + w.title + '</h3><div class="wk__dates">' + fmt(w.start) + " – " + fmt(w.end) + "</div>" + topics + "</div>";
      }
      var p = prog(w.n);
      var stat = p.seen ? p.seen + "/" + p.total + " slides · " + p.xp + " XP" : "Not started";
      return '<a class="wk' + (i === nowIdx ? " is-now" : "") + '" href="weeks/week-' + pad(w.n) + '.html"><div class="wk__top"><div class="wk__num">' + pad(w.n) + '</div><div class="wk__tags">' + (i === nowIdx ? '<span class="tag">● Now</span>' : "") + tags + "</div></div><h3>" + w.title + '</h3><div class="wk__dates">' + fmt(w.start) + " – " + fmt(w.end) + "</div>" + topics +
        '<div class="wk__foot"><div class="ring" style="--p:' + p.pct + '" data-label="' + p.pct + '%"></div><div class="wk__stat">' + stat + '</div><span class="wk__go">' + (p.seen ? "Resume →" : "Open →") + "</span></div></a>";
    }).join("");
  }
  renderWeeks("all");
  Array.prototype.forEach.call(document.querySelectorAll("#filters button"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("#filters button"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderWeeks(b.getAttribute("data-f"));
    });
  });

  $("#teamLine").innerHTML = "<strong>Course coordinator:</strong> " + C.team.coordinator + " · <strong>Lecturers:</strong> " + C.team.lecturers.join(" · ");
  $("#resetBtn").addEventListener("click", function () {
    if (!confirm("Clear all your saved progress, XP, ticks and drafts in this browser?")) return;
    try { localStorage.removeItem("smb31202.progress.v1"); } catch (e) {}
    location.reload();
  });

  /* hero particle network */
  var cv = $("#net");
  if (cv && !reduce) {
    var ctx = cv.getContext("2d"), pts = [], W, H, mouse = { x: -999, y: -999 };
    function size() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(90, Math.floor(W * H / 14000));
      pts = []; for (var i = 0; i < n; i++) pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4 });
    }
    size(); window.addEventListener("resize", size);
    cv.parentElement.addEventListener("mousemove", function (e) { var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    (function loop() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, dd = dx * dx + dy * dy;
          if (dd < 15000) { ctx.strokeStyle = "rgba(120,170,255," + (0.18 * (1 - dd / 15000)) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
        var mdx = p.x - mouse.x, mdy = p.y - mouse.y, md = mdx * mdx + mdy * mdy;
        if (md < 25000) { ctx.strokeStyle = "rgba(62,230,255," + (0.5 * (1 - md / 25000)) + ")"; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
        ctx.fillStyle = i % 3 ? "rgba(62,230,255,.8)" : "rgba(255,95,210,.8)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 6.3); ctx.fill();
      }
      requestAnimationFrame(loop);
    })();
  }
})();
