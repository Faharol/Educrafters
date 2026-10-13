/* =========================================================
   Motion layer · shared by the home page and every weekly issue
   - parallax on cover photos and chapter photos
   - words that darken as you read (pull quotes, lead text)
   - 3D tilt + light sweep on cards, magnetic buttons
   - burst of particles on a correct answer
   All of it switches off for ?static and prefers-reduced-motion.
   ========================================================= */
(function () {
  "use strict";
  if (window.Motion) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STATIC = /[?&]static\b/.test(location.search);
  var off = reduce || STATIC;
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- burst (used by quizzes) ---------- */
  function burst(target) {
    if (off) return;
    var r = target.getBoundingClientRect();
    var cx = r.left + Math.min(r.width, 90) / 2 + 20, cy = r.top + r.height / 2;
    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:120";
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    document.body.appendChild(c);
    var ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    var cols = ["#0071e3", "#6e4ff6", "#d1307a", "#1a8f3c", "#ff9f0a"], ps = [], i;
    for (i = 0; i < 34; i++) {
      var a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
      ps.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, s: 3 + Math.random() * 4, c: cols[i % 5], r: Math.random() * 6, life: 1 });
    }
    var f = 0;
    (function loop() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(function (p) {
        p.vy += 0.16; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.r += 0.2; p.life -= 0.017;
        if (p.life <= 0) return;
        ctx.save(); ctx.globalAlpha = p.life; ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
      });
      if (++f < 62) requestAnimationFrame(loop); else c.remove();
    })();
  }

  /* ---------- word-by-word reading reveal ---------- */
  var wordBlocks = [];
  function splitWords(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentNode.closest && n.parentNode.closest("cite")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    var words = [];
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var sp = document.createElement("span"); sp.className = "w"; sp.textContent = part;
        frag.appendChild(sp); words.push(sp);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return words;
  }
  function setupWords() {
    if (off) return;
    $$(".slide .pull, .slide > .slide__lead").forEach(function (el) {
      if (el.closest(".slide--title, .slide--part, .finale")) return;
      var words = splitWords(el);
      if (words.length < 4) return;
      el.classList.add("wr");
      wordBlocks.push({ el: el, words: words, done: false });
    });
  }
  function updateWords(vh) {
    wordBlocks.forEach(function (b) {
      if (b.done) return;
      var r = b.el.getBoundingClientRect();
      if (r.bottom < -50) { b.words.forEach(function (w) { w.classList.add("on"); }); b.done = true; return; }
      if (r.top > vh) return;
      var p = clamp((vh * 0.88 - r.top) / (vh * 0.5), 0, 1);
      var n = Math.round(p * b.words.length);
      for (var i = 0; i < b.words.length; i++) b.words[i].classList.toggle("on", i < n);
      if (n >= b.words.length && r.top < vh * 0.4) b.done = true;
    });
  }

  /* ---------- parallax ---------- */
  var par = [];
  function setupParallax() {
    if (off) return;
    $$(".part-bg").forEach(function (el) { par.push({ el: el, host: el.parentNode, k: 0.16, scale: 1.18 }); });
    $$(".hero-frame, .hero__frame").forEach(function (fr) {
      var im = fr.querySelector("img"); if (im) par.push({ el: im, host: fr, k: 0.12, scale: 1.14 });
    });
    $$(".photo-fig--parallax img, .split > img").forEach(function (im) { /* optional */ });
  }
  function updateParallax(vh) {
    par.forEach(function (p) {
      var r = p.host.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var mid = (r.top + r.height / 2) - vh / 2;       // 0 when centred
      var y = clamp(-mid * p.k, -r.height * 0.1, r.height * 0.1);
      p.el.style.transform = "translate3d(0," + y.toFixed(1) + "px,0) scale(" + p.scale + ")";
    });
  }

  /* ---------- tilt + sweep on cards ---------- */
  function setupTilt() {
    if (off || coarse) return;
    $$("a.wk, .tile, .keystat, .assess, .next-issue__card").forEach(function (c) {
      if (c.classList.contains("tilt-card")) return;
      var raf = 0;
      c.classList.add("tilt-card");
      c.addEventListener("mousemove", function (e) {
        var r = c.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          c.style.setProperty("--rx", (-y * 5).toFixed(2) + "deg");
          c.style.setProperty("--ry", (x * 6).toFixed(2) + "deg");
          c.style.setProperty("--mx", ((x + 0.5) * 100).toFixed(1) + "%");
          c.style.setProperty("--my", ((y + 0.5) * 100).toFixed(1) + "%");
        });
      });
      c.addEventListener("mouseleave", function () {
        cancelAnimationFrame(raf);
        c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- magnetic buttons ---------- */
  function setupMagnet() {
    if (off || coarse) return;
    $$(".btn--primary, .hero__cta .btn").forEach(function (b) {
      b.addEventListener("mousemove", function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.22, y = (e.clientY - (r.top + r.height / 2)) * 0.3;
        b.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      b.addEventListener("mouseleave", function () { b.style.transform = ""; });
    });
  }

  /* ---------- loop ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    updateParallax(vh); updateWords(vh);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  function init() {
    document.documentElement.classList.add("motion-ready");
    if (off) { document.documentElement.classList.add("motion-off"); return; }
    setupWords(); setupParallax(); setupTilt(); setupMagnet();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();
  }
  window.Motion = { burst: burst, refresh: onScroll, tilt: setupTilt };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
