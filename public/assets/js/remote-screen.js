/* ETC Lab · phone remote, screen side (loaded only for the lecturer).
   The computer on the projector shows a QR; the lecturer's phone (signed in as admin) scans it
   and sends commands through /api/remote. This page long-polls for them and acts. */
(function () {
  "use strict";
  var L = window.LAB || {};
  var ROOT = L.root || "";
  var SKEY = "etc-remote";
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function adminKey() {
    try { var k = sessionStorage.getItem("etc_admin"); if (k) return k; } catch (e) {}
    var m = document.cookie.match(/(?:^|;\s*)etc_admin=([^;]*)/); try { return m ? decodeURIComponent(m[1]) : ""; } catch (e) { return ""; }
  }
  function api(method, q, body) {
    return fetch("/api/remote" + (q || ""), { method: method, headers: Object.assign({ "x-admin-key": adminKey() }, body ? { "content-type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined, cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || "Error " + r.status); e.status = r.status; throw e; } return d; }); });
  }
  function getSess() { try { return JSON.parse(sessionStorage.getItem(SKEY) || "null"); } catch (e) { return null; } }
  function setSess(s) { try { if (s) sessionStorage.setItem(SKEY, JSON.stringify(s)); else sessionStorage.removeItem(SKEY); } catch (e) {} }
  function toast(m) { if (L.toast) L.toast(m); }

  /* ---------- styles ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".rm-modal{position:fixed;inset:0;z-index:300;display:grid;place-items:center;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}" +
    ".rm-card{background:#111;color:#f5f5f7;border-radius:24px;padding:28px 32px;max-width:440px;width:calc(100vw - 32px);text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.5)}" +
    ".rm-card h3{margin:6px 0 6px;font-size:1.5rem;color:#fff}.rm-card p{color:#a1a1a6;margin:0 0 14px;font-size:.95rem}" +
    ".rm-qr{background:#fff;padding:14px;border-radius:18px;display:inline-block;margin:6px 0 14px}.rm-qr img,.rm-qr canvas{display:block}" +
    ".rm-card button{background:#2997ff;color:#fff;border:0;border-radius:999px;padding:10px 20px;font:600 .95rem inherit;cursor:pointer;margin:4px}.rm-card button.ghost{background:#2a2a2c}" +
    ".rm-react{position:fixed;bottom:-80px;z-index:290;font-size:72px;pointer-events:none;animation:rmUp 2.6s cubic-bezier(.2,.7,.3,1) forwards}" +
    "@keyframes rmUp{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-75vh) scale(1.25);opacity:0}}" +
    ".rm-timer{position:fixed;top:64px;right:20px;z-index:285;background:#111;color:#fff;font:700 3.2rem/1 var(--font-display,system-ui);padding:14px 22px;border-radius:20px;box-shadow:0 20px 50px rgba(0,0,0,.35);font-variant-numeric:tabular-nums}" +
    ".rm-timer.done{background:#ff453a;animation:rmPulse 1s infinite}@keyframes rmPulse{50%{transform:scale(1.06)}}" +
    ".rm-black{position:fixed;inset:0;z-index:295;background:#000}" +
    ".rm-big{position:fixed;inset:0;z-index:295;background:#000;color:#fff;display:grid;place-items:center;text-align:center}.rm-big .rm-qr{padding:22px;border-radius:26px}.rm-big p{font:600 1.6rem var(--font-display,system-ui);margin:18px 0 0}.rm-big small{display:block;color:#a1a1a6;font-size:1.1rem;margin-top:6px}" +
    ".gn .gl.gl-remote.is-on{color:#000;background:#2997ff;font-weight:700}";
  document.head.appendChild(css);

  function loadQR() {
    if (window.QRCode) return Promise.resolve();
    return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function drawQR(box, text, size) {
    return loadQR().then(function () { box.innerHTML = ""; new QRCode(box, { text: text, width: size, height: size, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M }); })
      .catch(function () { box.innerHTML = '<p style="color:#000;max-width:' + size + 'px;font-size:.85rem;word-break:break-all">' + esc(text) + "</p>"; });
  }

  /* ---------- sections on this page ---------- */
  function sections() {
    var list = $$("#hook, .slide, #news, #listen, #wall, #boss, .wweek, .lab-news");
    if (list.length < 2) list = $$("main > section, main > div > section, .band");
    var seen = [];
    list = list.filter(function (x) { if (seen.indexOf(x) >= 0 || !x.offsetHeight || x.closest("[hidden]")) return false; for (var i = 0; i < seen.length; i++) if (seen[i].contains(x)) return false; seen.push(x); return true; });
    list.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
    return list;
  }
  function title(x) {
    var t = x.getAttribute("data-title") || "";
    if (!t) { var h = $("h1, h2, h3, .display", x); t = h ? h.textContent : (x.id ? x.id.charAt(0).toUpperCase() + x.id.slice(1) : "Section"); }
    return t.replace(/^Part [A-Z0-9]+\s*[·:\-–]\s*/i, "").replace(/\s+/g, " ").trim().slice(0, 80);
  }
  function offset() { var o = 0; $$(".gn, .lnav").forEach(function (b) { var cs = getComputedStyle(b); if (cs.position === "sticky" || cs.position === "fixed") o += b.offsetHeight; }); return o + 8; }
  function curIndex(list) { var o = offset() + 40, idx = 0; list.forEach(function (x, i) { if (x.getBoundingClientRect().top <= o) idx = i; }); return idx; }
  function goTo(list, i) {
    i = Math.max(0, Math.min(list.length - 1, i)); var x = list[i]; if (!x) return;
    window.scrollTo({ top: x.getBoundingClientRect().top + window.scrollY - offset(), behavior: "smooth" });
  }

  /* ---------- overlays ---------- */
  var timerEl = null, timerT = null, timerEnd = 0, blackEl = null, bigEl = null;
  function react(e) {
    var n = document.createElement("div"); n.className = "rm-react"; n.textContent = e || "👏";
    n.style.left = (10 + Math.random() * 75) + "vw"; n.style.animationDuration = (2.2 + Math.random() * 0.9) + "s";
    document.body.appendChild(n); setTimeout(function () { n.remove(); }, 3400);
    if (Math.random() < .5) setTimeout(function () { var m = n.cloneNode(true); m.style.left = (10 + Math.random() * 75) + "vw"; document.body.appendChild(m); setTimeout(function () { m.remove(); }, 3400); }, 180);
  }
  function timer(secs) {
    clearInterval(timerT); if (timerEl) { timerEl.remove(); timerEl = null; } timerEnd = 0;
    if (!secs) return;
    timerEnd = Date.now() + secs * 1000;
    timerEl = document.createElement("div"); timerEl.className = "rm-timer"; document.body.appendChild(timerEl);
    var tick = function () { var left = Math.max(0, Math.round((timerEnd - Date.now()) / 1000)); timerEl.textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0"); if (!left) { timerEl.classList.add("done"); clearInterval(timerT); } };
    tick(); timerT = setInterval(tick, 250);
  }
  function black(on) { if (on == null) on = !blackEl; if (blackEl) { blackEl.remove(); blackEl = null; } if (on) { blackEl = document.createElement("div"); blackEl.className = "rm-black"; document.body.appendChild(blackEl); } }
  function studentQR() {
    if (bigEl) { bigEl.remove(); bigEl = null; return; }
    var url = location.origin + "/";
    bigEl = document.createElement("div"); bigEl.className = "rm-big";
    bigEl.innerHTML = '<div><div class="rm-qr"></div><p>Scan to open ETC Lab</p><small>' + esc(url.replace(/^https?:\/\//, "").replace(/\/$/, "")) + "</small></div>";
    document.body.appendChild(bigEl); drawQR($(".rm-qr", bigEl), url, 360);
  }
  function clearAll() { timer(0); black(false); if (bigEl) { bigEl.remove(); bigEl = null; } closeModal(); }
  function showAnswers() {
    var list = sections(), x = list[curIndex(list)]; if (!x) return;
    $$("details.reveal, details", x).forEach(function (d) { d.open = true; try { d.dispatchEvent(new Event("toggle")); } catch (e) {} });
    $$(".quiz", x).forEach(function (q) { var b = $(".quiz__opts button[data-correct]", q); if (b && !b.disabled) b.click(); });
    $$(".gapfill", x).forEach(function (g) { var b = $$(".gapfill__actions button", g)[1]; if (b) b.click(); });
    $$(".flip", x).forEach(function (f) { if (!f.classList.contains("is-flipped")) f.click(); });
    $$(".steps__btn", x).forEach(function (b) { for (var i = 0; i < 20 && !b.disabled; i++) b.click(); });
  }

  /* ---------- modal with the pairing QR ---------- */
  var modal = null;
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  function showPair(id) {
    closeModal();
    var url = location.origin + "/remote.html#" + id + "." + ((sess && sess.token) || "");
    modal = document.createElement("div"); modal.className = "rm-modal";
    modal.innerHTML = '<div class="rm-card"><p style="margin:0;color:#2997ff;font-weight:600">📱 Phone remote</p><h3>Scan with your phone</h3><p>Scan with your phone camera. No password needed. This QR hides itself once your phone connects.</p><div class="rm-qr"></div><p class="rm-st">Waiting for your phone…</p><button type="button" class="ghost" data-hide>Hide</button><button type="button" class="ghost" data-stop>Stop remote</button></div>';
    document.body.appendChild(modal);
    drawQR($(".rm-qr", modal), url, 240);
    $("[data-hide]", modal).addEventListener("click", closeModal);
    $("[data-stop]", modal).addEventListener("click", stop);
  }

  /* ---------- the session ---------- */
  var sess = null, polling = false, lastState = "";
  function navBtn() { var b = $(".gl-remote"); if (b) { b.classList.toggle("is-on", !!sess); b.textContent = sess ? "📱 Remote on" : "📱 Remote"; } }
  function postState(force) {
    if (!sess) return;
    var list = sections();
    var st = { title: document.title.replace(/ · SMB31202$/, ""), url: location.pathname, week: document.body.getAttribute("data-week") || "", sections: list.map(title), cur: curIndex(list), timer: timerEnd > Date.now() ? timerEnd : 0, black: !!blackEl };
    var key = JSON.stringify(st); if (!force && key === lastState) return; lastState = key;
    api("POST", "", { action: "state", id: sess.id, state: st }).catch(function () {});
  }
  function act(c) {
    var list = sections(), i = curIndex(list);
    switch (c.cmd) {
      case "hello": closeModal(); toast("📱 Phone connected"); break;
      case "next": goTo(list, i + 1); break;
      case "prev": goTo(list, i - 1); break;
      case "up": window.scrollBy({ top: -Math.round(innerHeight * 0.6), behavior: "smooth" }); break;
      case "down": window.scrollBy({ top: Math.round(innerHeight * 0.6), behavior: "smooth" }); break;
      case "top": window.scrollTo({ top: 0, behavior: "smooth" }); break;
      case "goto": goTo(list, parseInt(c.arg, 10) || 0); break;
      case "react": react(c.arg); break;
      case "answers": showAnswers(); break;
      case "timer": timer(parseInt(c.arg, 10) || 0); break;
      case "black": black(); break;
      case "qr": studentQR(); break;
      case "clear": clearAll(); break;
      case "week": var n = String(parseInt(c.arg, 10) || 1).padStart(2, "0"); location.href = ROOT + "weeks/week-" + n + ".html"; return;
      case "wall": var w = document.body.getAttribute("data-week"); try { sessionStorage.setItem("etc-remote-proj", "1"); } catch (e) {} location.href = ROOT + "wall.html" + (w ? "?board=w" + w : ""); return;
      case "home": location.href = ROOT + "index.html"; return;
    }
    setTimeout(function () { postState(); }, 900);
  }
  function poll() {
    if (!sess || polling) return; polling = true;
    api("GET", "?wait=" + sess.id + "&after=" + (sess.after || 0)).then(function (d) {
      polling = false;
      (d.cmds || []).forEach(function (c) { if (c.seq > (sess.after || 0)) { sess.after = c.seq; setSess(sess); act(c); } });
      poll();
    }).catch(function (e) {
      polling = false;
      if (e.status === 404 || e.status === 401) { toast(e.status === 401 ? "Sign in as lecturer again to use the remote." : "Remote session ended."); sess = null; setSess(null); navBtn(); return; }
      setTimeout(poll, 2500);
    });
  }
  function start() {
    if (sess && sess.token) { showPair(sess.id); return; }
    api("POST", "", { action: "start" }).then(function (d) {
      sess = { id: d.id, token: d.token, after: Date.now() * 1000 }; setSess(sess); navBtn(); showPair(d.id); postState(true); poll();
    }).catch(function (e) { toast(e.status === 401 ? "Sign in as lecturer first (Admin)." : "Could not start the remote. " + e.message); });
  }
  function stop() {
    var s = sess; sess = null; setSess(null); clearAll(); navBtn();
    if (s) api("POST", "", { action: "end", id: s.id }).catch(function () {});
    toast("Remote stopped");
  }

  /* nav button + resume after a page change */
  var nb = $(".gl-remote");
  if (nb) nb.addEventListener("click", function (e) { e.preventDefault(); start(); });
  sess = getSess(); navBtn();
  if (sess) { lastState = ""; setTimeout(function () { postState(true); }, 1200); poll(); }
  if (/[?&]remote=start\b/.test(location.search)) { try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {} setTimeout(start, 600); }
  try { if (sessionStorage.getItem("etc-remote-proj")) { sessionStorage.removeItem("etc-remote-proj"); setTimeout(function () { var p = $('[data-wall="proj"]'); if (p) p.click(); }, 1500); } } catch (e) {}
  var scT = null;
  window.addEventListener("scroll", function () { if (!sess) return; clearTimeout(scT); scT = setTimeout(function () { postState(); }, 700); }, { passive: true });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (bigEl || blackEl || timerEl) clearAll(); } });
  window.LABRemote = { start: start, stop: stop };
})();
