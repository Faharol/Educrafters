# Builds ext/air-content.js from the portal's air.js, so both share the same tuned gesture logic.
import re
src=open('/home/claude/educrafters/public/assets/js/air.js').read()
s=src
def rep(a,b):
    global s
    assert s.count(a)==1, (s.count(a), a[:80])
    s=s.replace(a,b)

rep('''  if (window.LABAir) return;''','''  if (window.LABAir) return;
  // the ETC Lab portal has this built in already
  if (location.hostname === "smb31202-etc.netlify.app") return;
  if (!document.documentElement || document.contentType && !/html/.test(document.contentType)) return;''')

# scroll whatever scrolls under the ring (many sites scroll an inner panel, not the window)
rep('''  /* ---------- on-screen buttons ---------- */''','''  /* ---------- what scrolls here ---------- */
  var scEl = null, scAt = 0;
  function scroller() {
    var now = performance.now();
    if (now - scAt < 600 && scEl) return scEl;
    scAt = now; scEl = window;
    var el = document.elementFromPoint(clamp(cx, 1, innerWidth - 2), clamp(cy, 1, innerHeight - 2));
    while (el && el !== document.body && el !== document.documentElement) {
      var st = getComputedStyle(el).overflowY;
      if ((st === "auto" || st === "scroll") && el.scrollHeight > el.clientHeight + 30) { scEl = el; break; }
      el = el.parentElement;
    }
    return scEl;
  }
  function pressKey(k, code) {
    var t = document.activeElement || document.body;
    ["keydown", "keyup"].forEach(function (type) {
      try { t.dispatchEvent(new KeyboardEvent(type, { key: k, code: k, keyCode: code, which: code, bubbles: true, cancelable: true })); } catch (e) {}
    });
  }
  // "next / previous" on a page with no sections: a screenful of scrolling, or the arrow keys on slide-style pages
  function pageStep(dir) {
    var sc = scroller(), win = sc === window;
    var max = win ? document.documentElement.scrollHeight - innerHeight : sc.scrollHeight - sc.clientHeight;
    var cur = win ? scrollY : sc.scrollTop;
    if (max > 40 && ((dir > 0 && cur < max - 2) || (dir < 0 && cur > 2))) sc.scrollBy({ top: dir * 0.85 * innerHeight, behavior: "smooth" });
    else pressKey(dir > 0 ? "ArrowRight" : "ArrowLeft", dir > 0 ? 39 : 37);
    candsAt = 0;
  }

  /* ---------- on-screen buttons ---------- */''')

rep('''    if (kind === "next") { resetZoom(); flingV = 0; wipe(1); swipeFx(1); if (R.act) R.act({ cmd: "next" }); }
    else if (kind === "prev") { resetZoom(); flingV = 0; wipe(-1); swipeFx(-1); if (R.act) R.act({ cmd: "prev" }); }''',
'''    if (kind === "next") { flingV = 0; wipe(1); swipeFx(1); pageStep(1); }
    else if (kind === "prev") { flingV = 0; wipe(-1); swipeFx(-1); pageStep(-1); }''')

n=s.count('window.scrollBy(')
s=s.replace('window.scrollBy(','scroller().scrollBy(')

# the extension gets its messages from the background worker, not from Ably directly
a=s.index('  /* ---------- realtime link (Ably) ---------- */'); b=s.index('  window.LABAir = {')
s=s[:a]+'''  /* ---------- link to the extension's background worker ---------- */
  var port = null, hideT = 0;
  function quietHud(text) { setHud(text, "paused"); clearTimeout(hideT); hideT = setTimeout(function () { if (!active) hud.classList.remove("on"); }, 4000); }
  function onStatus(st) {
    if (st === "connected") quietHud("Air control ready");
    else if (st === "nokey") quietHud("Air: sign in to the ETC Lab admin first");
    else if (st === "failed") quietHud("Air link failed");
    else if (st === "off") { if (active) sleep(""); hud.classList.remove("on"); }
  }
  function link() {
    try { port = chrome.runtime.connect({ name: "air" }); } catch (e) { return; }
    port.onMessage.addListener(function (m) {
      if (!m) return;
      if (m.status) { onStatus(m.status); return; }
      if (document.hidden) return;
      if (m.n === "p") onPose(parse(m.d)); else if (m.n === "e") onEvent(parse(m.d));
    });
    port.onDisconnect.addListener(function () { port = null; setTimeout(link, 1500); });
  }
  link();
  setInterval(function () { if (port && !document.hidden) { try { port.postMessage({ ping: 1 }); } catch (e) {} } }, 20000);
  document.addEventListener("visibilitychange", function () { if (document.hidden && active) sleep(""); });
  function connect() {}
  function disconnect() {}

'''+s[b:]

# pauses should not leave a label sitting on every web page
rep('''    setHud(text, "paused");
  }''','''    setHud(text, "paused");
    clearTimeout(hideT); hideT = setTimeout(function () { if (!active) hud.classList.remove("on"); }, 4000);
  }''')
rep('''      case "hello": toast("⌚ Watch linked · air control on"); setHud("Watch linked"); break;''','''      case "hello": quietHud("Watch linked"); break;''')
open('ext/air-content.js','w').write("/* ETC Air · content script. Generated from the ETC Lab portal's air.js by gen.py; edit there. */\n"+s)
print('scrollBy replaced', n)
