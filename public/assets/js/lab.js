/* =========================================================
   ETC Lab runtime · shared by home, week pages and the Class Wall
   - global nav, motion (rise, words, scrub, parallax, tilt), toast, confetti
   - Class Wall client (Netlify Function + Blobs)
   - AI writing coach client
   - Boss round (speed quiz built from a page's quizzes)
   ========================================================= */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("etclab:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("etclab:" + k, JSON.stringify(v)); } catch (e) {} }
  };
  var ss = {
    get: function (k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set: function (k, v) { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch (e) {} }
  };
  var ROOT = document.body.getAttribute("data-root") || "";
  var REDUCE = !!store.get("calm", false) || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || /[?&]static\b/.test(location.search);
  if (store.get("calm", false)) document.documentElement.classList.add("calm");
  var FINE = (function () { try { return matchMedia("(hover:hover) and (pointer:fine)").matches; } catch (e) { return false; } })();
  var now = new Date();
  var TODAY = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

  /* ---------- course helpers ---------- */
  var COURSE = window.COURSE || { weeks: [] };
  function weekInfo(n) { return COURSE.weeks.filter(function (w) { return w.n === n; })[0]; }
  function currentWeek() {
    var w = COURSE.weeks.filter(function (x) { return x.start <= TODAY && TODAY <= x.end; })[0];
    if (w && typeof w.n === "number") return w.n;
    var next = COURSE.weeks.filter(function (x) { return typeof x.n === "number" && x.start > TODAY; })[0];
    if (next) return next.n;
    return 14;
  }
  function fmtRange(s, e) {
    var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var a = s.split("-"), b = e.split("-");
    var ad = +a[2], bd = +b[2], am = M[+a[1] - 1], bm = M[+b[1] - 1];
    return am === bm ? ad + "–" + bd + " " + am + " " + a[0] : ad + " " + am + " – " + bd + " " + bm + " " + b[0];
  }
  var MODE = { on: "Online", f2f: "Face-to-face", test: "Assessment week", off: "Break" };

  /* ---------- nickname ---------- */
  var ADJ = ["spark", "turbo", "quiet", "tiny", "solar", "neon", "cosmic", "laser", "pixel", "steady", "bold", "kopi", "mega", "swift", "lucky", "zero", "delta", "sigma", "proto", "nano"];
  var NOUN = ["plug", "turbine", "circuit", "rocket", "gear", "pixel", "diode", "piston", "drone", "robot", "beam", "sensor", "valve", "welder", "bolt", "cable", "kernel", "motor", "chip", "bridge"];
  function nick() {
    var n = store.get("nick", "");
    if (n) return n;
    n = ADJ[Math.floor(Math.random() * ADJ.length)] + "_" + NOUN[Math.floor(Math.random() * NOUN.length)];
    store.set("nick", n);
    return n;
  }

  /* ---------- text helpers ---------- */
  function words(t, start, grad) {
    start = start || 0;
    return String(t).split(" ").map(function (w, i) { return '<span class="w' + (grad ? " lab-grad" : "") + '" style="--d:' + (start + i) + '">' + esc(w) + "</span>"; }).join(" ");
  }
  function scrubHtml(t, gradIdx) {
    gradIdx = gradIdx || [];
    return String(t).split(" ").map(function (w, i) { return '<span class="' + (gradIdx.indexOf(i) >= 0 ? "g" : "") + '">' + esc(w) + "</span>"; }).join(" ");
  }

  /* ---------- nav ---------- */
  function nav(current, totalXp) {
    var weeks = COURSE.weeks.filter(function (w) { return typeof w.n === "number"; });
    var cw = currentWeek();
    var html = '<div class="gn-in"><a class="brand" href="' + ROOT + 'index.html"><i>E</i>ETC Lab <span>· SMB31202</span></a><div class="gn-links">' +
      '<a class="gl ' + (current === "home" ? "on" : "") + '" href="' + ROOT + 'index.html">Home</a>' +
      weeks.map(function (w) { var id = "w" + pad(w.n); return '<a class="gl ' + (current === id ? "on" : "") + '" href="' + ROOT + "weeks/week-" + pad(w.n) + '.html" title="' + esc(w.title) + '">' + pad(w.n) + (w.n === cw ? '<span class="live" style="width:6px;height:6px;margin:0 0 0 4px;background:#ff9f0a;animation:none" aria-label="this week"></span>' : "") + "</a>"; }).join("") +
      '<a class="gl ' + (current === "wall" ? "on" : "") + '" href="' + ROOT + 'wall.html"><span class="live"></span>Wall</a></div>' +
      '<span class="gn-xp" id="gnXp" title="Experience points on this device">⚡ ' + (totalXp || 0) + ' XP</span></div><div class="gprog" id="gprog"></div>';
    var el = document.createElement("nav");
    el.className = "gn"; el.setAttribute("aria-label", "Main"); el.innerHTML = html;
    document.body.insertBefore(el, document.body.firstChild);
    var on = $(".gl.on", el), links = $(".gn-links", el);
    if (on && links.scrollWidth > links.clientWidth) links.scrollLeft = on.offsetLeft - links.clientWidth / 2 + on.offsetWidth / 2;
    return el;
  }
  function setXp(n, bump) {
    var x = $("#gnXp"); if (!x) return;
    x.textContent = "⚡ " + n + " XP";
    if (bump) { x.classList.remove("bump"); void x.offsetWidth; x.classList.add("bump"); }
  }
  function totalXpAll() {
    try {
      var raw = localStorage.getItem("smb31202.progress.v1"); if (!raw) return 0;
      var d = JSON.parse(raw), t = 0;
      Object.keys(d.weeks || {}).forEach(function (k) { var e = d.weeks[k].earned || {}; Object.keys(e).forEach(function (i) { t += e[i]; }); });
      return t;
    } catch (e) { return 0; }
  }

  /* ---------- toast + confetti ---------- */
  var toastEl, toastTimer;
  function toast(msg, label, fn) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast-l"; toastEl.setAttribute("role", "status"); toastEl.innerHTML = '<span></span><button type="button" hidden></button>'; document.body.appendChild(toastEl); }
    $("span", toastEl).textContent = msg;
    var b = $("button", toastEl);
    if (label) { b.hidden = false; b.textContent = label; b.onclick = function () { toastEl.classList.remove("show"); fn && fn(); }; } else { b.hidden = true; b.onclick = null; }
    toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, label ? 5500 : 2600);
  }
  var CF, parts = [], cfRun = false;
  function confetti(x, y, n) {
    if (REDUCE) return;
    if (!CF) { CF = document.createElement("canvas"); CF.id = "confetti"; CF.setAttribute("aria-hidden", "true"); document.body.appendChild(CF); }
    x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight / 3 : y; n = n || 150;
    var ctx = CF.getContext("2d"); var dpr = Math.min(2, devicePixelRatio || 1);
    if (!cfRun) { CF.width = innerWidth * dpr; CF.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    var cols = ["#2997FF", "#A855F7", "#FF4D8D", "#FF9F0A", "#30D158", "#FFD60A"];
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 10; parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 7, r: 5 + Math.random() * 6, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .45, life: 0 }); }
    if (cfRun) return; cfRun = true;
    (function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) { p.vy += .3; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, 1 - p.life / 150); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
      parts = parts.filter(function (p) { return p.life < 150 && p.y < innerHeight + 40; });
      if (parts.length) requestAnimationFrame(tick); else { cfRun = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    })();
  }
  function burstFrom(el) { var r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 120); }

  /* ---------- motion ---------- */
  var IO = null, GROW = [], PARA = [], SCRUB = [], STILT = [], ticking = false;
  function countUp(el) {
    var to = +el.getAttribute("data-count"), t0 = performance.now();
    var suffix = el.getAttribute("data-suffix") || "";
    function step(t) { var k = Math.min(1, (t - t0) / 1300); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suffix; if (k < 1) requestAnimationFrame(step); }
    el.textContent = "0" + suffix; requestAnimationFrame(step);
  }
  function settle(t) { var h = function (ev) { if (ev.target !== t) return; t.classList.remove("rv", "in"); t.removeEventListener("animationend", h); }; t.addEventListener("animationend", h); }
  function setupMotion(root) {
    root = root || document;
    if (IO) IO.disconnect();
    collect(root);
    if (!("IntersectionObserver" in window)) { SCRUB.forEach(function (s) { s.spans.forEach(function (x) { x.classList.add("lit"); }); }); onScroll(); return; }
    IO = new IntersectionObserver(function (es) { es.forEach(function (en) { if (!en.isIntersecting) return; var t = en.target; if (t.hasAttribute("data-count")) { if (!REDUCE) countUp(t); else t.textContent = t.getAttribute("data-count") + (t.getAttribute("data-suffix") || ""); } else { t.classList.add("in"); settle(t); } IO.unobserve(t); }); }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    var vh = innerHeight;
    $$("[data-rv] > *, .lab-bento > .ltile, .gallery > .ph, .stats > div, .rules > div, .lol > div, .assess > div", root).forEach(function (e) { if (e.getBoundingClientRect().top > vh * 0.92) { e.classList.add("rv"); IO.observe(e); } });
    $$("[data-count]", root).forEach(function (e) { if (e.getBoundingClientRect().top > vh * 0.92) IO.observe(e); else { e.textContent = e.getAttribute("data-count") + (e.getAttribute("data-suffix") || ""); } });
    onScroll();
  }
  function collect(root) {
    GROW = $$("[data-grow]", root); PARA = $$("[data-para]", root);
    SCRUB = $$("[data-scrub]", root).map(function (el) { return { el: el, spans: $$("span", el) }; });
    STILT = FINE ? [] : $$(".lab-bento .ltile, .gallery .ph", root);
    $$(".gallery", root).forEach(function (g) { g.addEventListener("scroll", onScroll, { passive: true }); });
  }
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false; var vh = innerHeight;
      var max = Math.max(1, document.documentElement.scrollHeight - vh);
      var gp = $("#gprog"); if (gp) gp.style.transform = "scaleX(" + Math.min(1, scrollY / max).toFixed(4) + ")";
      SCRUB.forEach(function (s) { var r = s.el.getBoundingClientRect(); var p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.3))); var lit = Math.round(p * s.spans.length); s.spans.forEach(function (x, i) { x.classList.toggle("lit", i < lit); }); });
      if (REDUCE) return;
      STILT.forEach(function (el) { if (el.classList.contains("rv")) return; var r = el.getBoundingClientRect(); if (r.bottom < -60 || r.top > vh + 60) return; var cy = (r.top + r.height / 2 - vh / 2) / vh, cx = (r.left + r.width / 2 - innerWidth / 2) / innerWidth; var inG = el.parentElement && el.parentElement.classList.contains("gallery"); el.style.transform = "perspective(800px) rotateX(" + (-cy * 24).toFixed(2) + "deg)" + (inG ? " rotateY(" + (cx * 20).toFixed(2) + "deg)" : "") + " scale(" + (1 - Math.min(.16, Math.abs(cy) * .3)).toFixed(3) + ")"; var im = el.querySelector("img"); if (im) im.style.translate = "0 " + (-cy * 70).toFixed(1) + "px"; });
      GROW.forEach(function (el) { var r = el.getBoundingClientRect(); var p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.9))); el.style.transform = "scale(" + (0.9 + 0.1 * p).toFixed(4) + ")"; });
      PARA.forEach(function (el) { var r = el.parentElement.getBoundingClientRect(); if (r.bottom < 0) return; el.style.transform = "translateY(" + Math.max(0, -r.top * 0.35).toFixed(1) + "px)"; });
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  var tiltEl = null;
  function untilt() { if (tiltEl) { tiltEl.classList.remove("tilting"); tiltEl.style.transform = ""; tiltEl = null; } }
  if (FINE && !REDUCE) {
    document.addEventListener("pointermove", function (e) { var el = e.target.closest && e.target.closest(".tilt"); if (el !== tiltEl) untilt(); if (!el) return; tiltEl = el; var r = el.getBoundingClientRect(); var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; el.classList.add("tilting"); el.style.setProperty("--mx", (x * 100).toFixed(1) + "%"); el.style.setProperty("--my", (y * 100).toFixed(1) + "%"); el.style.transform = "perspective(900px) rotateX(" + ((.5 - y) * 7).toFixed(2) + "deg) rotateY(" + ((x - .5) * 7).toFixed(2) + "deg) translateY(-4px)"; }, { passive: true });
    document.addEventListener("pointerout", function (e) { if (!e.relatedTarget) untilt(); });
  }
  function motionBtn() { return '<button class="mtoggle" type="button" data-motion>' + (store.get("calm", false) ? "Motion: off · turn on" : "Motion: on · turn off") + "</button>"; }
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-motion]")) { store.set("calm", !store.get("calm", false)); location.reload(); } });

  /* ---------- Class Wall client ---------- */
  var API = "/api/wall";
  var COLORS = ["blue", "pink", "orange", "green", "purple"];
  var hashStr = function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  function ago(ts) { var s = Math.max(1, Math.round((Date.now() - ts) / 1000)); if (s < 45) return "just now"; var m = Math.round(s / 60); if (m < 60) return m + " min ago"; var h = Math.round(m / 60); if (h < 24) return h + " h ago"; return Math.round(h / 24) + " d ago"; }
  function wallName(b) { if (b === "general") return "General"; var n = parseInt(b.slice(1), 10); var w = weekInfo(n); return pad(n) + (w ? " " + w.title : ""); }
  function wallPrompt(b) { if (b === "general") return "Say hi to the class. Who are you, which programme, and what do you want from this course?"; var n = parseInt(b.slice(1), 10); var h = window.HOOKS && window.HOOKS[n]; return h ? h.wall : "Post your thought for this week."; }
  var liked = store.get("liked", {});

  function Wall(opts) {
    var self = this;
    this.board = opts.board || "general";
    this.mount = opts.mount;
    this.compact = !!opts.compact;
    this.onPosted = opts.onPosted;
    this.posts = []; this.seen = {}; this.first = true; this.sig = ""; this.status = "loading";
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.pin = ss.get("wallpin");
    this.timer = null;
    this.render();
    this.load();
    this.timer = setInterval(function () { self.load(); }, 5000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) self.load(); });
  }
  Wall.prototype.grid = function () {
    var w = this;
    if (w.status === "offline") return '<div class="wempty"><h3>The live wall runs on the class website.</h3><p class="muted">Open the Netlify link to post and read everyone’s writing.</p></div>';
    if (w.status === "error" && !w.posts.length) return '<div class="wempty"><h3>Can’t reach the wall right now.</h3><p class="muted">Check the Wi-Fi. It will try again in a few seconds.</p></div>';
    if (w.status === "loading" && !w.posts.length) return '<div class="wempty"><p class="muted">Loading the wall…</p></div>';
    if (!w.posts.length) return '<div class="wempty"><h3>Nothing here yet.</h3><p class="muted">Be the first to post on this board.</p></div>';
    var k = 0;
    return '<div class="wall">' + w.posts.map(function (p) {
      var rot = ((hashStr(p.id) % 7) - 3) * .55; var isNew = !w.seen[p.id]; var delay = isNew && w.first ? Math.min(k++, 14) * 70 : 0;
      var did = !!liked[p.id];
      return '<article class="post c-' + esc(p.color) + (isNew ? " new" : "") + (p.pinned ? " pinned" : "") + '" style="--rot:' + rot.toFixed(2) + "deg;" + (delay ? "animation-delay:" + delay + "ms" : "") + '">' +
        (p.pinned ? '<span class="pinlab">Pinned by lecturer</span>' : "") +
        '<div class="nm"><span>' + esc(p.name) + '</span><span data-ts="' + (+p.ts) + '">' + ago(p.ts) + "</span></div>" +
        '<p class="nt">' + esc(p.text) + "</p>" +
        '<div class="acts"><button class="like' + (did ? " did" : "") + '" type="button" data-like="' + esc(p.id) + '" aria-label="Like this post">' + (did ? "♥" : "♡") + " " + (p.likes || 0) + "</button>" +
        (w.pin ? '<span class="ltools"><button type="button" data-pin="' + esc(p.id) + '" data-on="' + (p.pinned ? 0 : 1) + '">' + (p.pinned ? "Unpin" : "Pin") + '</button><button type="button" data-delpost="' + esc(p.id) + '">Delete</button></span>' : "") +
        "</div></article>";
    }).join("") + "</div>";
  };
  Wall.prototype.draw = function () {
    var g = $("[data-wallgrid]", this.mount); if (!g) return;
    g.innerHTML = this.grid();
    var w = this; this.posts.forEach(function (p) { w.seen[p.id] = 1; });
    if (this.posts.length) this.first = false;
    var c = $("[data-wcount]", this.mount); if (c) c.textContent = this.status === "ok" ? this.posts.length + " post" + (this.posts.length === 1 ? "" : "s") + " on " + wallName(this.board) : "";
  };
  Wall.prototype.load = function () {
    var w = this, b = w.board;
    fetch(API + "?board=" + encodeURIComponent(b), { cache: "no-store" }).then(function (r) {
      var ct = r.headers.get("content-type") || "";
      if (w.board !== b) return;
      if (!ct.includes("json")) { w.status = "offline"; w.draw(); return; }
      if (!r.ok) { w.status = "error"; w.draw(); return; }
      return r.json().then(function (d) {
        var sig = d.posts.map(function (p) { return p.id + ":" + (p.likes || 0) + ":" + (p.pinned ? 1 : 0); }).join(",") + "|" + (w.pin ? 1 : 0);
        w.status = "ok"; w.posts = d.posts;
        if (sig !== w.sig) { w.sig = sig; w.draw(); } else { $$("[data-ts]", w.mount).forEach(function (el) { el.textContent = ago(+el.getAttribute("data-ts")); }); }
      });
    }).catch(function () { w.status = w.posts.length ? "ok" : "error"; w.draw(); });
  };
  Wall.prototype.post = function (text, name, color) {
    var w = this;
    return fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ board: w.board, name: name, text: text, color: color || w.color }) })
      .catch(function () { throw new Error("offline"); })
      .then(function (r) { var ct = r.headers.get("content-type") || ""; if (!ct.includes("json")) throw new Error("offline"); return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Could not post. Try again."); return d.post; }); });
  };
  Wall.prototype.setBoard = function (b) { this.board = b; this.posts = []; this.status = "loading"; this.first = true; this.sig = ""; this.seen = {}; var p = $("[data-wprompt]", this.mount); if (p) p.textContent = wallPrompt(b); this.draw(); this.load(); };
  Wall.prototype.render = function () {
    var w = this, m = this.mount;
    var composer = '<div class="' + (w.compact ? "wcomp" : "wcomp2") + '" data-wcomp>' +
      '<div class="panel-h"><p class="wprompt' + (w.compact ? "" : "-sm") + '" data-wprompt>' + esc(wallPrompt(w.board)) + '</p><div class="swatches" role="group" aria-label="Card colour">' + COLORS.map(function (c) { return '<button class="sw c-' + c + (w.color === c ? " on" : "") + '" type="button" data-sw="' + c + '" aria-label="' + c + ' card"></button>'; }).join("") + "</div></div>" +
      '<textarea data-wt maxlength="600" placeholder="Write your post here…" aria-label="Your post"></textarea>' +
      '<div class="wrow"><div class="left"><input data-wn placeholder="Nickname" maxlength="30" value="' + esc(nick()) + '" aria-label="Your nickname"><span class="muted small" data-wtc>0 / 600</span></div><button class="lbtn" type="button" data-wallpost>Post to the wall</button></div></div>';
    var tools = '<div class="wtools"><span class="muted small" data-wcount></span><div class="chips">' + (w.compact ? '<a class="lchip" href="' + ROOT + 'wall.html?board=' + w.board + '">Open the full wall ›</a>' : '<button class="lchip" type="button" data-wall="proj">Projector mode</button>') + '<button class="lchip" type="button" data-wall="refresh">Refresh</button><button class="lchip" type="button" data-wall="lect">' + (w.pin ? "Lecturer mode: on" : "Lecturer") + "</button></div></div>" +
      '<div class="pinrow" data-lect hidden><strong>Lecturer PIN</strong><input data-lpin type="password" inputmode="numeric" maxlength="12" placeholder="PIN" aria-label="Lecturer PIN"><button class="lbtn sm" type="button" data-wall="pin">Unlock</button>' + (w.pin ? '<button class="lbtn sm ghost" type="button" data-wall="lock">Turn off</button>' : "") + '<span class="muted small" data-lmsg>Unlock to pin or remove posts.</span></div>';
    m.innerHTML = composer + tools + '<div data-wallgrid>' + this.grid() + "</div>";
    var wt = $("[data-wt]", m), wn = $("[data-wn]", m);
    wt.addEventListener("input", function () { $("[data-wtc]", m).textContent = wt.value.length + " / 600"; });
    wn.addEventListener("input", function () { store.set("nick", wn.value.trim()); });
    m.addEventListener("click", function (e) {
      var sw = e.target.closest("[data-sw]"); if (sw) { w.color = sw.getAttribute("data-sw"); $$("[data-sw]", m).forEach(function (x) { x.classList.toggle("on", x === sw); }); return; }
      var lk = e.target.closest("[data-like]"); if (lk) {
        var id = lk.getAttribute("data-like"); if (liked[id]) { toast("You already liked that one."); return; }
        liked[id] = 1; store.set("liked", liked); lk.classList.add("did"); lk.textContent = "♥ " + ((+lk.textContent.replace(/\D/g, "") || 0) + 1); burstFrom(lk);
        fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ like: true, board: w.board, id: id }) }).then(function () { w.sig = ""; }).catch(function () {});
        return;
      }
      var pn = e.target.closest("[data-pin]"); if (pn) {
        fetch(API + "?board=" + encodeURIComponent(w.board) + "&id=" + encodeURIComponent(pn.getAttribute("data-pin")) + "&pin=" + pn.getAttribute("data-on"), { method: "PATCH", headers: { "x-wall-pin": w.pin } }).then(function (r) { if (!r.ok) throw 0; w.sig = ""; w.load(); toast(pn.getAttribute("data-on") === "1" ? "Pinned to the top." : "Unpinned."); }).catch(function () { toast("Couldn’t do that. Check your PIN."); });
        return;
      }
      var d = e.target.closest("[data-delpost]"); if (d) {
        var did = d.getAttribute("data-delpost");
        fetch(API + "?board=" + encodeURIComponent(w.board) + "&id=" + encodeURIComponent(did), { method: "DELETE", headers: { "x-wall-pin": w.pin } }).then(function (r) { if (!r.ok) throw 0; w.posts = w.posts.filter(function (p) { return p.id !== did; }); w.sig = ""; w.draw(); toast("Post removed."); }).catch(function () { toast("Couldn’t remove it. Check your PIN."); });
        return;
      }
      var p = e.target.closest("[data-wallpost]"); if (p) {
        var text = wt.value.trim(), name = wn.value.trim();
        if (text.length < 2) { wt.focus(); toast("Write something first."); return; }
        p.disabled = true;
        w.post(text, name).then(function (post) { w.status = "ok"; w.posts = [post].concat(w.posts.filter(function (x) { return x.id !== post.id; })); w.sig = ""; wt.value = ""; $("[data-wtc]", m).textContent = "0 / 600"; w.draw(); burstFrom(p); toast("Posted. The whole class can see it."); if (w.onPosted) w.onPosted(post); })
          .catch(function (err) { toast(err.message === "offline" ? "The wall works on the Netlify site, not on this copy." : err.message); })
          .then(function () { p.disabled = false; });
        return;
      }
      var a = e.target.closest("[data-wall]"); if (!a) return;
      var x = a.getAttribute("data-wall");
      if (x === "proj") setProj(true);
      if (x === "refresh") { w.sig = ""; w.load(); }
      if (x === "lect") { var l = $("[data-lect]", m); l.hidden = !l.hidden; if (!l.hidden) $("[data-lpin]", m).focus(); }
      if (x === "lock") { w.pin = ""; ss.set("wallpin", ""); w.render(); w.draw(); }
      if (x === "pin") { var pin = $("[data-lpin]", m).value.trim(); fetch(API + "?auth=1", { headers: { "x-wall-pin": pin } }).then(function (r) { if (!r.ok) throw 0; w.pin = pin; ss.set("wallpin", pin); w.render(); w.sig = ""; w.load(); toast("Lecturer mode on. You can pin and remove posts."); }).catch(function () { $("[data-lmsg]", m).textContent = "That PIN didn’t work."; }); }
    });
  };
  function setProj(on) { document.body.classList.toggle("proj", on); var x = $("#projx"); if (!x && on) { x = document.createElement("button"); x.id = "projx"; x.className = "lbtn white sm projx"; x.type = "button"; x.textContent = "Exit projector mode"; x.addEventListener("click", function () { setProj(false); }); document.body.appendChild(x); } if (x) x.hidden = !on; try { if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); if (!on && document.fullscreenElement) document.exitFullscreen().catch(function () {}); } catch (e) {} }
  document.addEventListener("fullscreenchange", function () { if (!document.fullscreenElement && document.body.classList.contains("proj")) setProj(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.body.classList.contains("proj")) setProj(false); });

  /* ---------- AI coach ---------- */
  function coach(writeEl, meta) {
    var ta = $("textarea", writeEl); if (!ta) return;
    var box = document.createElement("div"); box.className = "coach";
    box.innerHTML = '<ul class="coach__selfcheck"><li>Purpose and reader are clear in the first sentence.</li><li>Every paragraph has one job.</li><li>Numbers and trends are stated, not just "went up".</li><li>Tense, agreement and articles checked once.</li></ul>' +
      '<div class="row"><button class="lbtn dark sm" type="button" data-coach>✦ Get feedback from the AI coach</button><span class="coach__status" data-cstatus>Feedback only. It never writes for you.</span></div><div class="coach__out" data-cout></div>';
    writeEl.appendChild(box);
    var btn = $("[data-coach]", box), st = $("[data-cstatus]", box), out = $("[data-cout]", box);
    var last = 0;
    btn.addEventListener("click", function () {
      var text = ta.value.trim(); var n = (text.match(/\S+/g) || []).length;
      if (n < 15) { st.textContent = "Write at least 15 words first."; ta.focus(); return; }
      if (Date.now() - last < 20000) { st.textContent = "Give it a moment before asking again."; return; }
      last = Date.now(); btn.disabled = true; st.textContent = "Reading your draft…";
      fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text, task: meta.task, week: meta.week, title: meta.title, min: meta.min, max: meta.max }) })
        .then(function (r) { var ct = r.headers.get("content-type") || ""; if (!ct.includes("json")) throw new Error("The coach only works on the Netlify site."); return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Try again in a minute."); return d; }); })
        .then(function (d) { out.innerHTML = fmtFeedback(d.feedback); out.classList.add("show"); st.textContent = "Fix one thing, then ask again."; burstFrom(btn); if (meta.onFeedback) meta.onFeedback(); })
        .catch(function (e) { st.textContent = e.message; })
        .then(function () { btn.disabled = false; });
    });
  }
  function fmtFeedback(t) {
    var H = ["Overall", "What works", "Fix these", "Score", "Next step"];
    return esc(t).split("\n").map(function (line) { var l = line.trim(); if (H.indexOf(l.replace(/[:*#]+$/, "").replace(/^[#*\s]+/, "")) >= 0) return "<b>" + l.replace(/[:*#]/g, "").trim() + "</b>"; return l; }).join("\n").replace(/\n{3,}/g, "\n\n");
  }

  /* ---------- Boss round ---------- */
  function boss(mount, qs, opts) {
    opts = opts || {};
    var N = Math.min(10, qs.length), TIME = opts.seconds || 90, LIVES = 3;
    var st = {};
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function intro() {
      mount.innerHTML = '<div class="intro"><div><p class="eyebrow">Boss round</p><h2 class="big">' + ({10:"Ten",9:"Nine",8:"Eight",7:"Seven",6:"Six",5:"Five",4:"Four"}[N] || N) + ' questions.<br><span class="muted">Three lives. Ninety seconds.</span></h2><p class="lede">' + esc(opts.blurb || "Everything from this week, fast. Answer streaks multiply your XP.") + '</p><div class="facts" style="margin-top:18px"><span>' + N + " questions</span><span>" + LIVES + " lives</span><span>" + TIME + ' s</span><span>+' + (opts.xp || 40) + ' XP max</span></div></div><div class="glow"><div class="qcard" style="justify-content:center;align-items:center;text-align:center"><p class="qtext" style="flex:0">Ready?</p><p class="why">Pair up: one reads, one answers. Or go solo.</p><button class="lbtn white" type="button" data-start>Start the boss round</button>' + (st.best != null ? '<p class="why">Best so far: ' + st.best + "/" + N + "</p>" : "") + "</div></div></div>";
      $("[data-start]", mount).addEventListener("click", start);
    }
    var queue, i, lives, score, streak, best = 0, left, iv, done;
    function start() {
      queue = shuffle(qs).slice(0, N); i = 0; lives = LIVES; score = 0; streak = 0; left = TIME; done = false;
      mount.innerHTML = '<div class="glow"><div class="qcard" data-card></div></div>';
      clearInterval(iv); iv = setInterval(function () { left--; if (left <= 0) { finish("Time’s up."); } else { var t = $("[data-timer]", mount); if (t) { t.textContent = left; t.classList.toggle("end", left <= 10); } var b = $(".tbar i", mount); if (b) b.style.width = (left / TIME * 100) + "%"; } }, 1000);
      show();
    }
    function show() {
      var q = queue[i]; var card = $("[data-card]", mount); if (!card) return;
      card.classList.remove("flip"); void card.offsetWidth; card.classList.add("flip");
      var opts2 = shuffle(q.opts.map(function (o, k) { return { t: o, right: k === q.right }; }));
      card.innerHTML = '<div class="qtop"><div class="hud"><span class="qno">' + (i + 1) + " / " + N + '</span><span class="lives" aria-label="Lives">' + "♥".repeat(lives) + "<span style=\"opacity:.25\">" + "♥".repeat(LIVES - lives) + "</span></span>" + (streak >= 2 ? '<span class="streak">🔥 ' + streak + " streak</span>" : "") + '</div><span class="timer-l' + (left <= 10 ? " end" : "") + '" data-timer>' + left + "</span></div>" +
        '<div class="tbar"><i style="width:' + (left / TIME * 100) + '%"></i></div>' +
        '<p class="qtext">' + q.q + '</p><div class="opts">' + opts2.map(function (o, k) { return '<button class="opt" type="button" data-k="' + k + '"' + (o.right ? ' data-right="1"' : "") + '><span class="k">' + "ABCD"[k] + "</span><span>" + o.t + "</span></button>"; }).join("") + '</div><p class="why" data-why></p>';
      $$(".opt", card).forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled) return;
          $$(".opt", card).forEach(function (x) { x.disabled = true; });
          var right = b.hasAttribute("data-right");
          if (right) { b.classList.add("right"); score++; streak++; best = Math.max(best, streak); burstFrom(b); } else { b.classList.add("wrong"); lives--; streak = 0; var r = $(".opt[data-right]", card); if (r) r.classList.add("right"); }
          $("[data-why]", card).textContent = q.why || (right ? "Correct." : "Not that one.");
          setTimeout(function () { i++; if (lives <= 0) finish("Out of lives."); else if (i >= N) finish("You made it."); else show(); }, right ? 700 : 1400);
        });
      });
    }
    function finish(msg) {
      if (done) return; done = true; clearInterval(iv);
      var card = $("[data-card]", mount); if (!card) return;
      var xp = Math.round((opts.xp || 40) * score / N);
      card.classList.remove("flip"); void card.offsetWidth; card.classList.add("flip");
      card.innerHTML = '<div class="end"><p class="eyebrow">' + esc(msg) + '</p><div class="score lab-grad">' + score + " / " + N + '</div><p class="why" style="color:#fff">' + (score === N ? "Perfect run. Screenshot it." : score >= N * .7 ? "Strong. One more run for a perfect score?" : "Read the chapter once more, then come back.") + " Best streak: " + best + '.</p><p class="why">+' + xp + ' XP</p><div class="chips" style="justify-content:center"><button class="lbtn white" type="button" data-again>Play again</button></div></div>';
      $("[data-again]", card).addEventListener("click", start);
      if (score >= N * .5) confetti();
      if (opts.onDone) opts.onDone(score, N, xp);
    }
    intro();
    return { start: start };
  }

  window.LAB = { $: $, $$: $$, esc: esc, pad: pad, store: store, nav: nav, setXp: setXp, totalXp: totalXpAll, words: words, scrubHtml: scrubHtml, toast: toast, confetti: confetti, burstFrom: burstFrom, setupMotion: setupMotion, motionBtn: motionBtn, Wall: Wall, wallPrompt: wallPrompt, wallName: wallName, coach: coach, boss: boss, nick: nick, currentWeek: currentWeek, weekInfo: weekInfo, fmtRange: fmtRange, MODE: MODE, TODAY: TODAY, REDUCE: REDUCE, setProj: setProj, root: ROOT };
})();
