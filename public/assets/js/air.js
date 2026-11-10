/* ETC Lab · Air control (Apple Watch as a motion pointer), screen side.
   Loaded by remote-screen.js only for a lecturer with a live remote session.
   The watch publishes its arm pose to an Ably channel; this page draws a glowing ring and acts.

   Messages (data may be a JSON string):
     "p"  { s:seq, a:0|1 (arm up), m:0 point|1 scroll|2 zoom, x:yaw deg (+ = turned left), y:elevation deg (+ = up) }
          x and y are relative to where the arm settled after being raised, so a raise re-centres the ring.
     "e"  { s:seq, k:"click"|"next"|"prev"|"zreset"|"hello", x?, y? }  (x,y: pose just before the gesture) */
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
    ".air-hud{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:8px 16px 8px 12px;border-radius:999px;background:rgba(2,16,24,.78);border:1px solid rgba(79,227,255,.55);box-shadow:0 0 18px rgba(64,220,255,.35),inset 0 0 12px rgba(64,220,255,.12);color:#bff6ff;font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .3s}" +
    ".air-hud.on{opacity:1}.air-hud .dot{width:9px;height:9px;border-radius:50%;background:#4fe3ff;box-shadow:0 0 8px #4fe3ff}" +
    ".air-hud.paused .dot{background:#6b7c84;box-shadow:none}.air-hud.paused{color:#8aa3ad;border-color:rgba(120,150,160,.4);box-shadow:none}" +
    ".air-hud.warm{border-color:rgba(255,190,60,.7);color:#ffe2a6;box-shadow:0 0 18px rgba(255,170,40,.35)}.air-hud.warm .dot{background:#ffbe3c;box-shadow:0 0 8px #ffbe3c}" +
    ".air-swipe{position:absolute;top:50%;font:200 120px/1 system-ui;color:#4fe3ff;text-shadow:0 0 24px #4fe3ff;margin-top:-60px;animation:airSwipe .6s ease-out forwards}" +
    ".air-swipe.r{right:6vw}.air-swipe.l{left:6vw}@keyframes airSwipe{0%{opacity:0;transform:translateX(0)}30%{opacity:1}100%{opacity:0;transform:translateX(var(--d))}}" +
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
    '<div class="air-hud"><span class="dot"></span><span class="txt">Air control</span></div>';
  // on <html>, not <body>, so zooming the page does not move the overlay
  document.documentElement.appendChild(layer);
  var ring = layer.querySelector(".air-ring"), glyph = layer.querySelector(".glyph");
  var lock = layer.querySelector(".air-lock"), lockLabel = lock.querySelector("b");
  var hud = layer.querySelector(".air-hud"), hudTxt = hud.querySelector(".txt");

  /* ---------- tuning ---------- */
  var GX = 24, GY = 14;          // degrees of arm turn from the centre to the screen edge
  var SNAP_R = 70;               // px: a clickable this close pulls the ring onto itself
  var STALE = 1600;              // ms without packets = watch gone quiet

  /* ---------- state ---------- */
  var active = false, mode = 0, lastSeq = -1, lastEv = {}, lastAt = 0;
  var offX = 0, offY = 0, rawX = 0, rawY = 0;           // degrees after edge drag
  var tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
  var scrollY0 = 0, scrollV = 0;
  var zoom = 1, zoomY0 = 0, zoom0 = 1, zoomOrigin = null;
  var snapped = null, cands = [], candsAt = 0;
  var lastY = 0, lastX = 0;

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
  function modeName() { return mode === 1 ? "↕ Scroll" : mode === 2 ? "⌕ Zoom " + zoom.toFixed(1) + "×" : "◎ Point"; }

  /* ---------- zoom (a lens on the page; the overlay stays sharp) ---------- */
  function applyZoom() {
    var b = document.body;
    if (zoom <= 1.02) {
      zoom = 1; b.style.transform = ""; b.style.transformOrigin = ""; document.documentElement.classList.remove("air-zoomed"); zoomOrigin = null; return;
    }
    if (!zoomOrigin) zoomOrigin = [cx + scrollX, cy + scrollY];
    document.documentElement.classList.add("air-zoomed");
    b.style.transformOrigin = zoomOrigin[0] + "px " + zoomOrigin[1] + "px";
    b.style.transform = "scale(" + zoom.toFixed(3) + ")";
  }
  function resetZoom() { zoom = 1; applyZoom(); }

  /* ---------- packets ---------- */
  function parse(d) { if (typeof d === "string") { try { return JSON.parse(d); } catch (e) { return null; } } return d; }
  function onPose(p) {
    if (!p || typeof p.s !== "number") return;
    if (p.s <= lastSeq) return;          // arrived late; a newer pose is already shown
    lastSeq = p.s; lastAt = performance.now();
    var x = +p.x || 0, y = +p.y || 0, m = p.m | 0;
    if (!p.a) {
      if (active) { active = false; scrollV = 0; ring.classList.remove("on"); lock.classList.remove("on"); snapped = null; }
      setHud("⏸ Arm down", "paused");
      return;
    }
    if (!active) { active = true; offX = 0; offY = 0; mode = -1; cx = tx = innerWidth / 2; cy = ty = innerHeight / 2; }
    if (m !== mode) {
      if (m === 1) { scrollY0 = y; }
      if (m === 2) { zoomY0 = y; zoom0 = zoom; if (zoom <= 1.02) zoomOrigin = null; }
      if (m === 0 && (mode === 1 || mode === 2)) { offY += y - lastY; offX += -x + lastX; } // keep the ring where it was when pointing resumes
      mode = m;
      ring.classList.toggle("mode-scroll", m === 1); ring.classList.toggle("mode-zoom", m === 2);
      glyph.textContent = m === 1 ? "↕" : m === 2 ? "⌕" : "";
    }
    if (m === 0) {
      dragEdges(x, y);
      var s = toScreen(x, y); tx = s[0]; ty = s[1];
      lastX = x; lastY = y;
    } else if (m === 1) {
      var d = y - scrollY0, a = Math.abs(d);
      scrollV = a < 3 ? 0 : (d > 0 ? -1 : 1) * Math.min(2000, Math.pow(a - 3, 1.35) * 55); // hand up = page up
    } else {
      zoom = clamp(zoom0 * Math.pow(2, (y - zoomY0) / 14), 1, 4);
      applyZoom();
    }
    if (m !== 1) scrollV = 0;
    ring.classList.add("on");
    setHud(modeName(), m === 0 ? "" : "warm");
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
    switch (e.k) {
      case "hello": toast("⌚ Watch linked · air control on"); setHud("Watch linked"); break;
      case "click":
        var px = cx, py = cy;
        if (snapped) { var r = snapped.el.getBoundingClientRect(); px = (r.left + r.right) / 2; py = (r.top + r.bottom) / 2; }
        if (e.x != null && e.y != null && mode === 0 && !snapped) { var s = toScreen(+e.x, +e.y); px = s[0]; py = s[1]; }
        clickAt(px, py); break;
      case "next": resetZoom(); swipeFx(1); if (R.act) R.act({ cmd: "next" }); break;
      case "prev": resetZoom(); swipeFx(-1); if (R.act) R.act({ cmd: "prev" }); break;
      case "zreset": resetZoom(); setHud(modeName()); break;
    }
  }

  /* ---------- frame loop: smooth the ring, snap, scroll ---------- */
  var lastT = performance.now();
  function frame(t) {
    var dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if (active && t - lastAt > STALE) { active = false; scrollV = 0; ring.classList.remove("on"); lock.classList.remove("on"); snapped = null; setHud("Watch quiet", "paused"); }
    if (active) {
      if (scrollV) { window.scrollBy({ top: scrollV * dt, behavior: "instant" }); candsAt = 0; }
      if (mode === 0) {
        var k = 1 - Math.exp(-dt * 16);
        cx += (tx - cx) * k; cy += (ty - cy) * k;
        if (t - candsAt > 400) refreshCands();
        var hit = nearest(tx, ty);
        if (hit) {
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
  window.addEventListener("resize", function () { candsAt = 0; });

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
    client = null; chan = null; active = false; resetZoom();
    ring.classList.remove("on"); lock.classList.remove("on"); hud.classList.remove("on");
  }

  window.LABAir = {
    connect: connect, disconnect: disconnect,
    feed: function (name, data) { if (name === "p") onPose(parse(data)); else onEvent(parse(data)); }, // for testing
    state: function () { return { active: active, mode: mode, cx: cx, cy: cy, zoom: zoom, scrollV: scrollV, snapped: snapped ? labelOf(snapped.el) : null }; }
  };
})();
