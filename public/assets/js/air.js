/* ETC Lab · Air control (Apple Watch as a motion pointer), screen side.
   Loaded by remote-screen.js only for a lecturer with a live remote session.
   The watch publishes its arm pose to an Ably channel; this page draws a glowing ring and acts.

   Messages (data may be a JSON string):
     "p"  { s:seq, a:0|1 (arm up), m:0 point|1 scroll|2 zoom, x:yaw deg (+ = turned left), y:elevation deg (+ = up) }
          x and y are relative to where the arm settled after being raised, so a raise re-centres the ring.
     "e"  { s:seq, k:"click"|"next"|"prev"|"zreset"|"hello", x?, y? }  (x,y: pose just before the gesture)

   Version 3 (simple): the watch also sends r = palm roll in degrees (0 palm down, 90 thumb up).
     palm down            -> point
     thumb up             -> scroll: move the hand up/down from where it was
     double tap on a target -> click; on empty space -> zoom in there; again -> zoom out
     PREV / NEXT at the bottom: rest the ring on them (or click)

   Big arm gestures (watch app v2) arrive as events too:
     "next"/"prev"  swing the arm left/right        -> section change with a wipe
     "fling" {v}    flick up/down (deg/s, + = up)   -> the page glides with momentum (flick up = content goes up)
     "push"/"pull"  thrust toward / away from screen -> zoom in / out on the ring
     "dbg" {...}    calibration numbers, shown in a small panel */
(function () {
  "use strict";
  if (window.LABAir) return;
  var L = window.LAB || {};
  function toast(m) { if (L.toast) L.toast(m); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- look ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".air-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483000}" +
    ".air-ring{position:absolute;left:0;top:0;width:64px;height:64px;margin:-32px 0 0 -32px;scale:1.25;opacity:0;transition:opacity .25s;will-change:transform}" +
    ".air-ring.on{opacity:1}" +
    ".air-ring svg{position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 6px rgba(64,220,255,.9)) drop-shadow(0 0 16px rgba(64,220,255,.45))}" +
    ".air-ring .spin{transform-origin:32px 32px;animation:airSpin 2.4s linear infinite}" +
    ".air-ring .spin2{transform-origin:32px 32px;animation:airSpin 5s linear infinite reverse}" +
    "@keyframes airSpin{to{transform:rotate(360deg)}}" +
    ".air-ring .glyph{position:absolute;inset:0;display:grid;place-items:center;color:#7fe7ff;font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-shadow:0 0 6px rgba(64,220,255,.9)}" +
    ".air-ring.snap svg{opacity:.35}" +
    ".air-ring.mode-scroll svg,.air-ring.mode-zoom svg{filter:drop-shadow(0 0 8px rgba(255,190,60,.95)) drop-shadow(0 0 20px rgba(255,170,40,.5))}" +
    ".air-ring.mode-scroll .glyph,.air-ring.mode-zoom .glyph{color:#ffd27a;text-shadow:0 0 6px rgba(255,180,50,.9);font-size:15px}" +
    ".air-lock{position:absolute;left:0;top:0;opacity:0;transition:opacity .15s;will-change:transform,width,height}" +
    ".air-lock.on{opacity:1}" +
    ".air-lock i{position:absolute;width:14px;height:14px;border:2.5px solid #4fe3ff;filter:drop-shadow(0 0 5px rgba(64,220,255,.95))}" +
    ".air-lock i:nth-child(1){left:-7px;top:-7px;border-right:0;border-bottom:0;border-radius:6px 0 0 0}" +
    ".air-lock i:nth-child(2){right:-7px;top:-7px;border-left:0;border-bottom:0;border-radius:0 6px 0 0}" +
    ".air-lock i:nth-child(3){left:-7px;bottom:-7px;border-right:0;border-top:0;border-radius:0 0 0 6px}" +
    ".air-lock i:nth-child(4){right:-7px;bottom:-7px;border-left:0;border-top:0;border-radius:0 0 6px 0}" +
    ".air-lock b{position:absolute;left:-7px;bottom:calc(100% + 10px);white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis;background:rgba(0,20,30,.82);color:#9ff0ff;border:1px solid rgba(79,227,255,.6);border-radius:6px;padding:3px 8px;font:600 12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;box-shadow:0 0 12px rgba(64,220,255,.35)}" +
    ".air-lock .fill{position:absolute;inset:-4px;border-radius:10px;background:rgba(64,220,255,.08);box-shadow:inset 0 0 18px rgba(64,220,255,.25)}" +
    ".air-pulse{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #4fe3ff;box-shadow:0 0 18px #4fe3ff,inset 0 0 12px #4fe3ff;animation:airPulse .55s ease-out forwards}" +
    "@keyframes airPulse{to{transform:scale(4.2);opacity:0;border-width:1px}}" +
    ".air-flash{animation:airFlash .45s ease-out}@keyframes airFlash{0%{box-shadow:0 0 0 3px #4fe3ff,0 0 30px #4fe3ff}100%{box-shadow:0 0 0 0 rgba(79,227,255,0)}}" +
    ".air-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:14px}" +
    ".air-dock{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:grid;gap:12px}" +
    ".air-btn{position:relative;overflow:hidden;width:88px;height:88px;border-radius:22px;display:grid;place-items:center;background:rgba(2,16,24,.74);border:1.5px solid rgba(79,227,255,.5);color:#bff6ff;font:500 36px/1 system-ui,sans-serif;box-shadow:0 0 14px rgba(64,220,255,.22),inset 0 0 14px rgba(64,220,255,.1);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .25s,transform .12s,background .12s,box-shadow .12s}" +
    ".air-btn small{position:absolute;left:0;right:0;bottom:8px;text-align:center;font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;color:#7fd8ea}" +
    ".air-btn.wide{width:150px;height:64px;font-size:22px;font-weight:700;letter-spacing:.04em}" +
    ".air-btn.sep{margin-top:10px}" +
    ".air-live .air-btn{opacity:1}.air-live .air-btn.dim{opacity:.35}" +
    ".air-btn.hot{transform:scale(1.1);background:rgba(16,84,104,.9);border-color:#4fe3ff;color:#fff;box-shadow:0 0 28px rgba(64,220,255,.75),inset 0 0 18px rgba(64,220,255,.3)}" +
    ".air-btn::after{content:'';position:absolute;left:0;bottom:0;height:5px;width:calc(var(--p,0)*100%);background:#4fe3ff;box-shadow:0 0 10px #4fe3ff}" +
    ".air-focus{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border:2px dashed #ffbe3c;border-radius:50%;box-shadow:0 0 14px rgba(255,190,60,.7);opacity:0;transition:opacity .15s}" +
    ".air-focus.on{opacity:1}.air-focus::before,.air-focus::after{content:'';position:absolute;background:#ffbe3c}" +
    ".air-focus::before{left:50%;top:-10px;bottom:-10px;width:2px;margin-left:-1px}.air-focus::after{top:50%;left:-10px;right:-10px;height:2px;margin-top:-1px}" +
    ".air-hud{min-width:200px;justify-content:center;display:flex;align-items:center;gap:10px;padding:8px 16px 8px 12px;border-radius:999px;background:rgba(2,16,24,.78);border:1px solid rgba(79,227,255,.55);box-shadow:0 0 18px rgba(64,220,255,.35),inset 0 0 12px rgba(64,220,255,.12);color:#bff6ff;font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .3s}" +
    ".air-hud.on{opacity:1}.air-hud .dot{width:9px;height:9px;border-radius:50%;background:#4fe3ff;box-shadow:0 0 8px #4fe3ff}" +
    ".air-hud.paused .dot{background:#6b7c84;box-shadow:none}.air-hud.paused{color:#8aa3ad;border-color:rgba(120,150,160,.4);box-shadow:none}" +
    ".air-hud.warm{border-color:rgba(255,190,60,.7);color:#ffe2a6;box-shadow:0 0 18px rgba(255,170,40,.35)}.air-hud.warm .dot{background:#ffbe3c;box-shadow:0 0 8px #ffbe3c}" +
    ".air-swipe{position:absolute;top:50%;font:200 120px/1 system-ui;color:#4fe3ff;text-shadow:0 0 24px #4fe3ff;margin-top:-60px;animation:airSwipe .6s ease-out forwards}" +
    ".air-swipe.r{right:6vw}.air-swipe.l{left:6vw}@keyframes airSwipe{0%{opacity:0;transform:translateX(0)}30%{opacity:1}100%{opacity:0;transform:translateX(var(--d))}}" +
    ".air-wipe{position:absolute;top:0;bottom:0;width:60vw;background:linear-gradient(90deg,transparent,rgba(79,227,255,.10) 30%,rgba(79,227,255,.38) 50%,rgba(79,227,255,.10) 70%,transparent);border-left:2px solid rgba(159,240,255,.0);animation:airWipe .55s cubic-bezier(.3,.6,.3,1) forwards}" +
    ".air-wipe::after{content:'';position:absolute;top:0;bottom:0;left:50%;width:3px;background:#bff6ff;box-shadow:0 0 30px 6px rgba(79,227,255,.9)}" +
    "@keyframes airWipe{from{transform:translateX(var(--from))}to{transform:translateX(var(--to))}}" +
    ".air-streak{position:absolute;width:2px;height:22vh;background:linear-gradient(180deg,transparent,rgba(159,240,255,.85),transparent);animation:airStreak .5s ease-out forwards}" +
    "@keyframes airStreak{from{transform:translateY(0);opacity:1}to{transform:translateY(var(--dy));opacity:0}}" +
    ".air-wave{position:absolute;width:80px;height:80px;margin:-40px 0 0 -40px;border-radius:50%;border:3px solid #ffd27a;box-shadow:0 0 26px rgba(255,190,60,.8),inset 0 0 20px rgba(255,190,60,.5);animation:airWave .6s ease-out forwards}" +
    ".air-wave.in{animation-name:airWaveIn}" +
    "@keyframes airWave{from{transform:scale(.4);opacity:1}to{transform:scale(7);opacity:0;border-width:1px}}" +
    "@keyframes airWaveIn{from{transform:scale(7);opacity:0;border-width:1px}60%{opacity:1}to{transform:scale(.4);opacity:0}}" +
    ".air-boot{position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid #4fe3ff;box-shadow:0 0 30px rgba(79,227,255,.7),inset 0 0 30px rgba(79,227,255,.35);animation:airBoot .7s cubic-bezier(.2,.7,.3,1) forwards}" +
    ".air-boot.b2{animation-delay:.12s;border-style:dashed;opacity:0}" +
    "@keyframes airBoot{0%{transform:scale(6) rotate(0);opacity:0}40%{opacity:1}100%{transform:scale(.5) rotate(120deg);opacity:0}}" +
    ".air-trail{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#9ff0ff;box-shadow:0 0 12px 3px rgba(79,227,255,.8);animation:airTrail .45s ease-out forwards}" +
    "@keyframes airTrail{to{transform:scale(.1);opacity:0}}" +
    ".air-dbg{position:absolute;left:14px;top:120px;min-width:300px;padding:12px 14px;border-radius:12px;background:rgba(2,16,24,.9);border:1px solid rgba(79,227,255,.6);color:#bff6ff;font:600 14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 0 18px rgba(64,220,255,.3)}" +
    ".air-dbg h4{margin:0 0 6px;font:700 12px/1 ui-monospace,monospace;letter-spacing:.14em;color:#7fd8ea}.air-dbg table{border-collapse:collapse;width:100%}.air-dbg td{padding:2px 8px 2px 0}.air-dbg td:nth-child(n+2){text-align:right}.air-dbg .ok{color:#7dffb0}.air-dbg .no{color:#ffb86b}.air-dbg small{display:block;margin-top:6px;color:#8fb5c0;font-weight:500}" +
    "html.air-zoomed body{transition:transform .08s linear}";
  document.head.appendChild(css);

  var layer = document.createElement("div"); layer.className = "air-layer";
  layer.innerHTML =
    '<div class="air-lock"><span class="fill"></span><i></i><i></i><i></i><i></i><b></b></div>' +
    '<div class="air-ring"><svg viewBox="0 0 64 64" width="64" height="64">' +
    '<circle cx="32" cy="32" r="30" fill="rgba(2,18,28,.30)" stroke="rgba(2,18,28,.55)" stroke-width="5"/>' +
    '<circle cx="32" cy="32" r="27" fill="none" stroke="rgba(79,227,255,.5)" stroke-width="1.2"/>' +
    '<g class="spin"><circle cx="32" cy="32" r="27" fill="none" stroke="#4fe3ff" stroke-width="2.5" stroke-dasharray="30 140" stroke-linecap="round"/></g>' +
    '<g class="spin2"><circle cx="32" cy="32" r="20" fill="none" stroke="#9ff0ff" stroke-width="1.5" stroke-dasharray="4 6"/></g>' +
    '<circle cx="32" cy="32" r="3.2" fill="#e8fdff"/></svg><div class="glyph"></div></div>' +
    '<div class="air-focus"></div>' +
    '<div class="air-bar">' +
    '<div class="air-btn wide" data-air="prev" data-label="Previous section">‹ PREV</div>' +
    '<div class="air-hud"><span class="dot"></span><span class="txt">Air control</span></div>' +
    '<div class="air-btn wide" data-air="next" data-label="Next section">NEXT ›</div>' +
    '</div>';
  // on <html>, not <body>, so zooming the page does not move the overlay
  document.documentElement.appendChild(layer);
  var ring = layer.querySelector(".air-ring"), glyph = layer.querySelector(".glyph");
  var lock = layer.querySelector(".air-lock"), lockLabel = lock.querySelector("b");
  var hud = layer.querySelector(".air-hud"), hudTxt = hud.querySelector(".txt");
  var focusEl = layer.querySelector(".air-focus"), zoutBtn = layer.querySelector('[data-air="zout"]');
  var hudBtns = [].slice.call(layer.querySelectorAll("[data-air]"));

  /* ---------- tuning ---------- */
  var GX = 24, GY = 14;          // degrees of arm turn from the centre to the screen edge
  var SNAP_R = 70;               // px: a clickable this close pulls the ring onto itself
  var STALE = 1600;              // ms without packets = watch gone quiet
  var EASY = true;               // point + click only; everything else is an on-screen button
  var DWELL = 800;               // ms the ring rests on Prev/Next before it fires by itself

  /* ---------- state ---------- */
  var active = false, mode = 0, lastSeq = -1, lastEv = {}, lastAt = 0;
  var offX = 0, offY = 0, rawX = 0, rawY = 0;           // degrees after edge drag
  var tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
  var scrollY0 = 0, scrollV = 0;
  var zoom = 1, zoomY0 = 0, zoom0 = 1, zoomOrigin = null;
  var snapped = null, cands = [], candsAt = 0;
  var lastY = 0, lastX = 0;
  var hudRects = [], hudAt = 0, hudHover = null, hoverAt = 0, hoverFired = false;
  var focus = [innerWidth / 2, innerHeight / 2], anchor = [innerWidth / 2, innerHeight / 2], anchorAt = 0;
  var wantM = 0, wantAt = 0, ZOOM_IN = 2.2;
  // Scrolling, tuned on the owner's own use (10 Nov 2026): his hand sits thumb-up about a quarter of the
  // time while talking, so scrolling has to be slow, has to be armed by holding still, and rests after use.
  var SCROLL_DEAD = 7;           // degrees of hand movement that do nothing
  var SCROLL_GAIN = 26;          // px/s per degree beyond that
  var SCROLL_MAX = 600;          // px/s at most (under one screen a second)
  var SCROLL_ARM = 600;          // ms thumb-up before scrolling can start
  var SCROLL_REST = 1200;        // ms pause after a scroll ends
  var scrollArmAt = 0, wasScrolling = false, flingRestUntil = 0;
  var zoomTarget = 1, flingV = 0, trailAt = 0, trailX = 0, trailY = 0, dbgEl = null, dbgHist = [];

  /* ---------- effects ---------- */
  function fx(cls, style, ms) {
    var n = document.createElement("div"); n.className = cls;
    for (var k in style) { if (k.slice(0, 2) === "--") n.style.setProperty(k, style[k]); else n.style[k] = style[k]; }
    layer.appendChild(n); setTimeout(function () { n.remove(); }, ms); return n;
  }
  function wipe(dir) { fx("air-wipe", { "--from": dir > 0 ? "100vw" : "-60vw", "--to": dir > 0 ? "-60vw" : "100vw" }, 600); }
  function streaks(dir) {
    for (var i = 0; i < 9; i++) fx("air-streak", { left: (6 + Math.random() * 88) + "vw", top: (10 + Math.random() * 60) + "vh", "--dy": (dir > 0 ? -1 : 1) * (18 + Math.random() * 22) + "vh", animationDelay: (i * 18) + "ms" }, 800);
  }
  function wave(px, py, inward) { fx("air-wave" + (inward ? " in" : ""), { left: px + "px", top: py + "px" }, 650); }
  function boot() { fx("air-boot", {}, 800); fx("air-boot b2", {}, 950); }
  function showDbg(d) {
    var now = performance.now(), ef = +d.ef || 1;
    dbgHist.push({ t: now, d: d }); while (dbgHist.length && now - dbgHist[0].t > 6000) dbgHist.shift();
    var pk = { yr: 0, pr: 0, pu: 0, pl: 0, tw: 0 };
    dbgHist.forEach(function (h) { for (var k in pk) pk[k] = Math.max(pk[k], Math.abs(+h.d[k] || 0)); });
    if (!dbgEl) { dbgEl = document.createElement("div"); dbgEl.className = "air-dbg"; layer.appendChild(dbgEl); }
    var rows = [["Swing left/right", "yr", 220 * ef, "°/s", 0], ["Flick up/down", "pr", 190 * ef, "°/s", 0], ["Push", "pu", 0.42 * ef, "g", 2], ["Pull", "pl", 0.42 * ef, "g", 2], ["Twist (click)", "tw", 380 * ef, "°/s", 0]];
    dbgEl.innerHTML = "<h4>GESTURE CALIBRATION</h4><table><tr><td></td><td>now</td><td>best 6s</td><td>needs</td></tr>" + rows.map(function (r) {
      var v = Math.abs(+d[r[1]] || 0), b = pk[r[1]];
      return "<tr><td>" + r[0] + "</td><td>" + v.toFixed(r[4]) + "</td><td class='" + (b >= r[2] ? "ok" : "no") + "'>" + b.toFixed(r[4]) + "</td><td>" + r[2].toFixed(r[4]) + " " + r[3] + "</td></tr>";
    }).join("") + "</table><small>Do each gesture 3 times. Green = strong enough. Effort " + ef.toFixed(1) + "×</small>";
    clearTimeout(showDbg.t); showDbg.t = setTimeout(function () { if (dbgEl) { dbgEl.remove(); dbgEl = null; dbgHist = []; } }, 4000);
  }

  /* ---------- on-screen buttons ---------- */
  function refreshHud() {
    hudAt = performance.now();
    hudRects = hudBtns.map(function (el) {
      var hot = el.classList.contains("hot"); if (hot) el.classList.remove("hot");
      var r = el.getBoundingClientRect(); if (hot) el.classList.add("hot");
      return { el: el, kind: el.getAttribute("data-air"), r: r };
    });
  }
  function hitHud(px, py) {
    var M = 16;
    for (var i = 0; i < hudRects.length; i++) { var r = hudRects[i].r; if (px >= r.left - M && px <= r.right + M && py >= r.top - M && py <= r.bottom + M) return hudRects[i]; }
    return null;
  }
  function clearHover() {
    if (hudHover) { hudHover.el.classList.remove("hot"); hudHover.el.style.setProperty("--p", 0); }
    hudHover = null; focusEl.classList.remove("on"); lock.classList.remove("on"); ring.classList.remove("snap");
  }
  function pulseAt(px, py) {
    var p = document.createElement("div"); p.className = "air-pulse"; p.style.left = px + "px"; p.style.top = py + "px";
    layer.appendChild(p); setTimeout(function () { p.remove(); }, 650);
  }
  function hudAct(kind) {
    var R = window.LABRemote || {};
    if (kind === "next") { resetZoom(); flingV = 0; wipe(1); swipeFx(1); if (R.act) R.act({ cmd: "next" }); }
    else if (kind === "prev") { resetZoom(); flingV = 0; wipe(-1); swipeFx(-1); if (R.act) R.act({ cmd: "prev" }); }
    else if (kind === "up" || kind === "down") { window.scrollBy({ top: (kind === "up" ? -0.7 : 0.7) * innerHeight, behavior: "smooth" }); candsAt = 0; }
    else if (kind === "zin" || kind === "zout") { zoomTarget = clamp(zoomTarget * (kind === "zin" ? 1.4 : 1 / 1.4), 1, 4); }
  }
  function sleep(text) {
    active = false; scrollV = 0; flingV = 0; snapped = null; clearHover();
    ring.classList.remove("on", "snap"); lock.classList.remove("on"); layer.classList.remove("air-live");
    setHud(text, "paused");
  }

  function toScreen(x, y) {
    // x: + means arm turned left -> ring goes left
    var sx = innerWidth / 2 + ((-x - offX) / GX) * (innerWidth / 2);
    var sy = innerHeight / 2 - ((y - offY) / GY) * (innerHeight / 2);
    return [sx, sy];
  }
  function dragEdges(x, y) {
    // like a mouse at the edge of the screen: turning further drags the centre along
    var ex = -x - offX, ey = y - offY;
    if (ex > GX) offX = -x - GX; else if (ex < -GX) offX = -x + GX;
    if (ey > GY) offY = y - GY; else if (ey < -GY) offY = y + GY;
  }

  var SEL = "a[href],button,summary,input,select,textarea,label,[role=button],[onclick],.flip,.chip,[data-wall],[tabindex]:not([tabindex='-1'])";
  function refreshCands() {
    candsAt = performance.now();
    var list = document.querySelectorAll(SEL), out = [];
    for (var i = 0; i < list.length && out.length < 600; i++) {
      var el = list[i];
      if (el.disabled || el.closest(".air-layer") || el.closest("[hidden]")) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      if (r.width > innerWidth * 0.9 && r.height > innerHeight * 0.5) continue; // whole-section wrappers
      out.push({ el: el, r: r });
    }
    cands = out;
  }
  function nearest(px, py) {
    var best = null, bd = SNAP_R;
    for (var i = 0; i < cands.length; i++) {
      var r = cands[i].r;
      var dx = px < r.left ? r.left - px : px > r.right ? px - r.right : 0;
      var dy = py < r.top ? r.top - py : py > r.bottom ? py - r.bottom : 0;
      var d = Math.sqrt(dx * dx + dy * dy);
      // prefer the smaller target when the point is inside several (a button inside a link card)
      if (d === 0) d = -1 / Math.max(1, r.width * r.height);
      if (d < bd) { bd = d; best = cands[i]; }
    }
    return best;
  }
  function labelOf(el) {
    var t = el.getAttribute("aria-label") || el.getAttribute("title") || (el.tagName === "INPUT" ? el.value || el.getAttribute("placeholder") : "");
    if (!t) { var f = el.querySelector(".flip__front"); t = ((f || el).innerText || el.textContent || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^tap to flip/i.test(x); }).slice(0, 2).join(" · "); }
    t = t.replace(/\s+/g, " ").trim();
    return (t.length > 48 ? t.slice(0, 47) + "…" : t) || el.tagName.toLowerCase();
  }

  function setHud(text, cls) {
    hud.classList.add("on");
    hud.classList.toggle("paused", cls === "paused");
    hud.classList.toggle("warm", cls === "warm");
    hudTxt.textContent = text;
  }
  function modeName() {
    if (hudHover) return hudHover.el.getAttribute("data-label") + (/^z/.test(hudHover.kind) ? " " + zoom.toFixed(1) + "×" : "");
    if (mode === 1) return scrollV ? "↕ Scrolling" : (lastAt < scrollArmAt ? "↕ Scroll · hold" : "↕ Scroll · ready");
    if (mode === 2) return "⌕ Zoom " + zoom.toFixed(1) + "×";
    return zoom > 1.02 ? "◎ Point · " + zoom.toFixed(1) + "×" : "◎ Point";
  }

  /* ---------- zoom (a lens on the page; the overlay stays sharp) ---------- */
  function applyZoom() {
    var b = document.body;
    if (zoom <= 1.001) {
      zoom = 1; b.style.transform = ""; b.style.transformOrigin = ""; document.documentElement.classList.remove("air-zoomed"); zoomOrigin = null; if (zoutBtn) zoutBtn.classList.add("dim"); return;
    }
    if (!zoomOrigin) zoomOrigin = EASY ? [focus[0] + scrollX, focus[1] + scrollY] : [cx + scrollX, cy + scrollY];
    if (zoutBtn) zoutBtn.classList.remove("dim");
    document.documentElement.classList.add("air-zoomed");
    b.style.transformOrigin = zoomOrigin[0] + "px " + zoomOrigin[1] + "px";
    b.style.transform = "scale(" + zoom.toFixed(3) + ")";
  }
  function resetZoom() { zoom = 1; zoomTarget = 1; applyZoom(); }

  /* ---------- packets ---------- */
  function parse(d) { if (typeof d === "string") { try { return JSON.parse(d); } catch (e) { return null; } } return d; }
  function onPose(p) {
    if (!p || typeof p.s !== "number") return;
    if (p.s <= lastSeq) return;          // arrived late; a newer pose is already shown
    lastSeq = p.s; lastAt = performance.now();
    var x = +p.x || 0, y = +p.y || 0, m = 0;
    if (p.r != null) {
      // palm roll picks the mode; it has to hold for a moment so a passing twist does not switch
      var r = +p.r, want = wantM;
      if (r < 45) want = 0; else if (r > 60 && r < 140) want = 1;
      if (want !== wantM) { wantM = want; wantAt = lastAt; }
      // going into scroll takes a longer hold than coming out of it
      m = !active || mode < 0 ? 0 : (lastAt - wantAt >= (wantM === 1 ? 450 : 250) ? wantM : mode);
      if (!active) { wantM = 0; wantAt = lastAt; }
    }
    if (!p.a) { sleep("⏸ Arm down"); return; }
    if (!active) {
      active = true; offX = 0; offY = 0; mode = -1; cx = tx = innerWidth / 2; cy = ty = innerHeight / 2;
      layer.classList.add("air-live"); refreshHud(); anchor = [cx, cy]; anchorAt = performance.now(); boot();
    }
    if (m !== mode) {
      if (m === 1) { scrollY0 = null; scrollArmAt = lastAt + SCROLL_ARM; wasScrolling = false; }
      if (m === 2) { zoomY0 = y; zoom0 = zoom; if (zoom <= 1.02) zoomOrigin = null; }
      if (m === 0 && (mode === 1 || mode === 2)) { offY += y - lastY; offX += -x + lastX; } // keep the ring where it was when pointing resumes
      mode = m; clearHover(); snapped = null;
      ring.classList.toggle("mode-scroll", m === 1); ring.classList.toggle("mode-zoom", m === 2);
      glyph.textContent = m === 1 ? "↕" : m === 2 ? "⌕" : "";
    }
    if (m === 0) {
      dragEdges(x, y);
      var s = toScreen(x, y); tx = s[0]; ty = s[1];
      lastX = x; lastY = y;
    } else if (m === 1) {
      if (lastAt < scrollArmAt) { scrollV = 0; scrollY0 = null; }      // arming, or resting after a scroll
      else {
        if (scrollY0 === null) scrollY0 = y;                            // neutral = where the hand is now
        var d = y - scrollY0, a = Math.abs(d);
        if (a < SCROLL_DEAD) {
          scrollV = 0;
          if (wasScrolling) { wasScrolling = false; scrollArmAt = lastAt + SCROLL_REST; scrollY0 = null; }
        } else {
          wasScrolling = true;
          scrollV = (d > 0 ? -1 : 1) * Math.min(SCROLL_MAX, (a - SCROLL_DEAD) * SCROLL_GAIN);   // hand up = page up
        }
      }
    } else {
      zoom = clamp(zoom0 * Math.pow(2, (y - zoomY0) / 14), 1, 4);
      applyZoom();
    }
    if (m !== 1) scrollV = 0;
    ring.classList.add("on");
    setHud(modeName(), m === 0 && !hudHover ? "" : "warm");
  }

  function clickAt(px, py) {
    if (performance.now() - candsAt > 120) refreshCands();
    var hit = nearest(px, py), el = hit ? hit.el : document.elementFromPoint(px, py);
    if (hit) { px = (hit.r.left + hit.r.right) / 2; py = (hit.r.top + hit.r.bottom) / 2; }
    var p = document.createElement("div"); p.className = "air-pulse"; p.style.left = px + "px"; p.style.top = py + "px";
    layer.appendChild(p); setTimeout(function () { p.remove(); }, 650);
    if (!el || el === document.documentElement || el === document.body) return;
    el.classList.remove("air-flash"); void el.offsetWidth; el.classList.add("air-flash");
    setTimeout(function () { el.classList.remove("air-flash"); }, 500);
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit)$/i.test(el.type || "")) { el.focus(); return; }
    try { el.focus({ preventScroll: true }); } catch (e) {}
    var opts = { bubbles: true, cancelable: true, clientX: px, clientY: py, view: window };
    try { el.dispatchEvent(new PointerEvent("pointerdown", opts)); el.dispatchEvent(new MouseEvent("mousedown", opts)); el.dispatchEvent(new PointerEvent("pointerup", opts)); el.dispatchEvent(new MouseEvent("mouseup", opts)); } catch (e) {}
    el.click();
    setTimeout(refreshCands, 350);
  }
  function swipeFx(dir) {
    var n = document.createElement("div"); n.className = "air-swipe " + (dir > 0 ? "r" : "l"); n.textContent = dir > 0 ? "›" : "‹";
    n.style.setProperty("--d", (dir > 0 ? 80 : -80) + "px"); layer.appendChild(n); setTimeout(function () { n.remove(); }, 700);
  }
  function onEvent(e) {
    if (!e || !e.k) return;
    if (e.s != null) { if (lastEv[e.k + e.s]) return; lastEv[e.k + e.s] = 1; }
    var R = window.LABRemote || {};
    var kind = EASY && e.k === "zreset" ? "click" : e.k;
    switch (kind) {
      case "hello": toast("⌚ Watch linked · air control on"); setHud("Watch linked"); break;
      case "click":
        if (hudHover) {
          var hr = hudHover.r; pulseAt((hr.left + hr.right) / 2, (hr.top + hr.bottom) / 2);
          if (/^(prev|next)$/.test(hudHover.kind)) { if (!hoverFired) { hoverFired = true; hudAct(hudHover.kind); } }
          else hudAct(hudHover.kind);
          break;
        }
        if (mode === 1) break;                      // scrolling: a tap does nothing
        if (snapped) { var r = snapped.el.getBoundingClientRect(); clickAt((r.left + r.right) / 2, (r.top + r.bottom) / 2); break; }
        // nothing under the ring: double tap zooms in on that spot, and again zooms back out
        if (zoom > 1.02 || zoomTarget > 1.02) { zoomTarget = 1; wave(cx, cy, true); }
        else { focus = [cx, cy]; zoomOrigin = null; zoomTarget = ZOOM_IN; wave(cx, cy, false); }
        break;
      case "next": hudAct("next"); break;
      case "prev": hudAct("prev"); break;
      case "fling":
        var fv = +e.v || 0, nowF = performance.now();
        // only a strong, deliberate flick counts, it moves about a third of a screen, and then it rests
        if (Math.abs(fv) < 165 || nowF < flingRestUntil) break;
        flingRestUntil = nowF + 1500;
        // flick up throws the content up (the page scrolls down), like a touch screen
        flingV = clamp(fv * 4.5, -1300, 1300); streaks(fv > 0 ? 1 : -1); candsAt = 0; break;
      case "push":
        if (!hudHover && zoom <= 1.02) { focus = e.x != null && e.y != null ? toScreen(+e.x, +e.y) : [cx, cy]; zoomOrigin = null; }
        zoomTarget = clamp(zoomTarget * 1.7, 1, 4); wave(focus[0], focus[1], false); break;
      case "pull":
        zoomTarget = clamp(zoomTarget / 1.7, 1, 4); wave(focus[0], focus[1], true); break;
      case "dbg": showDbg(e); break;
      case "zreset": resetZoom(); setHud(modeName()); break;
    }
  }

  /* ---------- frame loop: smooth the ring, snap, scroll ---------- */
  var lastT = performance.now();
  function frame(t) {
    var dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if (active && t - lastAt > STALE) sleep("Watch quiet");
    // a zoom in progress finishes even if the arm drops meanwhile
    if (Math.abs(zoomTarget - zoom) > 0.004) { zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 9)); if (Math.abs(zoomTarget - zoom) <= 0.004 || (zoomTarget === 1 && zoom < 1.02)) zoom = zoomTarget; applyZoom(); }
    if (active) {
      if (scrollV) { window.scrollBy({ top: scrollV * dt, behavior: "instant" }); candsAt = 0; }
      if (flingV) {
        window.scrollBy({ top: flingV * dt, behavior: "instant" }); candsAt = 0;
        flingV *= Math.exp(-dt * 2.2); if (Math.abs(flingV) < 40) flingV = 0;
      }
      if (t - trailAt > 28) {
        var mvx = cx - trailX, mvy = cy - trailY;
        if (mvx * mvx + mvy * mvy > 324) { fx("air-trail", { left: cx + "px", top: cy + "px" }, 480); trailX = cx; trailY = cy; }
        trailAt = t;
      }
      if (mode === 0) {
        var k = 1 - Math.exp(-dt * 16);
        cx += (tx - cx) * k; cy += (ty - cy) * k;
        if (t - hudAt > 1000 && !hudHover) refreshHud();
        var hb = hitHud(tx, ty);
        if (hb !== hudHover && (!hb || !hudHover || hb.el !== hudHover.el)) {
          clearHover(); hudHover = hb; hoverAt = t; hoverFired = false;
          if (hb) { hb.el.classList.add("hot"); lockLabel.textContent = hb.el.getAttribute("data-label"); }
        }
        if (t - candsAt > 400) refreshCands();
        var hit = hudHover ? null : nearest(tx, ty);
        if (hudHover) {
          var held = t - hoverAt, hk = hudHover.kind, hr = hudHover.r;
          if (hk === "up" || hk === "down") {
            if (held > 220) { window.scrollBy({ top: (hk === "up" ? -1 : 1) * Math.min(1500, 450 + (held - 220) * 0.6) * dt, behavior: "instant" }); candsAt = 0; }
          } else if (hk === "zin" || hk === "zout") {
            focusEl.style.transform = "translate(" + focus[0] + "px," + focus[1] + "px)"; focusEl.classList.add("on");
            if (held > 280) { zoom = clamp(zoom * Math.exp((hk === "zin" ? 1 : -1) * dt * 0.55), 1, 4); if (hk === "zout" && zoom < 1.02) zoom = 1; zoomTarget = zoom; applyZoom(); }
          } else {
            hudHover.el.style.setProperty("--p", hoverFired ? 0 : clamp(held / DWELL, 0, 1));
            if (!hoverFired && held >= DWELL) { hoverFired = true; pulseAt((hr.left + hr.right) / 2, (hr.top + hr.bottom) / 2); hudAct(hk); }
          }
          snapped = null;
          lock.style.transform = "translate(" + hr.left + "px," + hr.top + "px)"; lock.style.width = hr.width + "px"; lock.style.height = hr.height + "px";
          lock.classList.add("on"); ring.classList.add("snap");
          cx += ((hr.left + hr.right) / 2 - cx) * k * 0.5; cy += ((hr.top + hr.bottom) / 2 - cy) * k * 0.5;
        } else {
          // remember where the ring last rested on the page: zoom goes in on that spot
          var ax = cx - anchor[0], ay = cy - anchor[1];
          if (ax * ax + ay * ay > 2500) { anchor = [cx, cy]; anchorAt = t; } else if (t - anchorAt > 350) focus = [anchor[0], anchor[1]];
        }
        if (hudHover) { /* handled above */ } else if (hit) {
          var r = hit.el.getBoundingClientRect();
          if (!snapped || snapped.el !== hit.el) { lockLabel.textContent = labelOf(hit.el); }
          snapped = { el: hit.el };
          lock.style.transform = "translate(" + r.left + "px," + r.top + "px)"; lock.style.width = r.width + "px"; lock.style.height = r.height + "px";
          lock.classList.add("on"); ring.classList.add("snap");
          // the ring leans toward the target, like a magnet
          var mx = (r.left + r.right) / 2, my = (r.top + r.bottom) / 2;
          cx += (mx - cx) * k * 0.5; cy += (my - cy) * k * 0.5;
        } else if (snapped) { snapped = null; lock.classList.remove("on"); ring.classList.remove("snap"); }
      } else if (snapped) { snapped = null; lock.classList.remove("on"); ring.classList.remove("snap"); }
      ring.style.transform = "translate(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px)";
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener("scroll", function () { candsAt = 0; }, { passive: true });
  window.addEventListener("resize", function () { candsAt = 0; hudAt = 0; });

  /* ---------- realtime link (Ably) ---------- */
  var client = null, chan = null;
  function connect(getToken) {
    var chanName = null;
    // Ably accounts on the per-user plan only accept their "device" SDK
    import("https://cdn.jsdelivr.net/npm/@ably/pubsub-device@3.0.0/+esm").then(function (mod) {
      var make = mod.createClient || (mod.default && mod.default.createClient);
      client = make({
        authCallback: function (params, cb) {
          getToken().then(function (d) { chanName = d.channel; cb(null, { token: d.token, expires: d.expires, issued: d.issued, capability: d.capability, keyName: d.keyName }); })
            .catch(function (e) { cb(e.message || String(e), null); });
        },
        echoMessages: false
      });
      client.connection.on("connected", function () {
        if (chan || !chanName) return;
        chan = client.channels.get(chanName);
        chan.subscribe("p", function (m) { onPose(parse(m.data)); });
        chan.subscribe("e", function (m) { onEvent(parse(m.data)); });
        setHud("Air control ready", "paused");
      });
      client.connection.on("failed", function (st) { setHud("Air link failed", "paused"); try { console.warn("Air link failed", st && st.reason && st.reason.message); } catch (e) {} });
    }).catch(function (e) { setHud("Air link failed", "paused"); console.warn("Air SDK load failed", e); });
  }
  function disconnect() {
    try { if (client) client.close(); } catch (e) {}
    client = null; chan = null; resetZoom(); sleep("");
    hud.classList.remove("on");
  }

  window.LABAir = {
    connect: connect, disconnect: disconnect,
    feed: function (name, data) { if (name === "p") onPose(parse(data)); else onEvent(parse(data)); }, // for testing
    poseFor: function (px, py) { return { x: -(((px - innerWidth / 2) / (innerWidth / 2)) * GX + offX), y: ((innerHeight / 2 - py) / (innerHeight / 2)) * GY + offY }; }, // for testing
    state: function () { return { active: active, mode: mode, cx: cx, cy: cy, zoom: zoom, scrollV: scrollV, snapped: snapped ? labelOf(snapped.el) : null, hud: hudHover ? hudHover.kind : null, focus: focus, flingV: flingV, zoomTarget: zoomTarget }; }
  };
})();
