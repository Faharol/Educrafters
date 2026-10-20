/* ETC Lab home page */
(function () {
  "use strict";
  var L = window.LAB, C = window.COURSE, H = window.HOOKS || {}, P = window.PHRASES || { report: [], talk: [] };
  var $ = L.$, esc = L.esc, pad = L.pad;
  L.nav("home", L.totalXp());

  /* progress on this device */
  var prog = { weeks: {} };
  try { prog = Object.assign(prog, JSON.parse(localStorage.getItem("smb31202.progress.v1") || "{}")); } catch (e) {}
  function weekDone(n) { var w = prog.weeks[pad(n)]; return !!(w && w.total && w.seen && w.seen.length >= Math.max(3, w.total - 1)); }
  function weekXp(n) { var w = prog.weeks[pad(n)]; var t = 0; if (w && w.earned) Object.keys(w.earned).forEach(function (k) { t += w.earned[k]; }); return t; }
  var weeks = C.weeks.filter(function (w) { return typeof w.n === "number"; });
  var cw = L.currentWeek();
  var done = weeks.filter(function (w) { return weekDone(w.n); }).length;
  var xp = L.totalXp();

  /* hero */
  $("#heroTitle").innerHTML = L.words("Write like an engineer.") + "<br>" + L.words("Speak like you mean it.", 4, true);
  var cur = weeks.filter(function (w) { return w.n === cw; })[0] || weeks[0];
  $("#heroCta").innerHTML = '<a class="lbtn" href="weeks/week-' + pad(cur.n) + '.html">Open Week ' + cur.n + " · " + esc(cur.title) + '</a><a class="llink" href="wall.html">Open the Class Wall ›</a>';

  /* scrub */
  var S = "This semester you won’t just study English. You’ll use it. To read a datasheet fast. To write a report your manager actually reads. To disagree with a teammate without a fight. And to defend an idea for three minutes, on your feet.";
  var sw = S.split(" "), gi = [];
  sw.forEach(function (w, i) { if (/^(use|reads\.|fight\.|feet\.)$/.test(w) || (i > 0 && /^(actually)$/.test(w))) gi.push(i); });
  $("#scrub").innerHTML = L.scrubHtml(S, gi);

  /* this device card */
  var rank = xp >= 1200 ? "Chief Engineer" : xp >= 800 ? "Lead Engineer" : xp >= 450 ? "Senior Engineer" : xp >= 200 ? "Engineer" : xp >= 60 ? "Junior Engineer" : "Cadet";
  var nextAt = [60, 200, 450, 800, 1200].filter(function (x) { return x > xp; })[0];
  $("#cw").innerHTML = '<div><p class="eyebrow">On this device</p><h3 style="font-size:clamp(1.5rem,3vw,2.2rem);margin:0 0 .3em">' + (done ? "You’re " + done + " of 14 weeks in." : "Week " + cur.n + " is live. Start there.") + '</h3><p class="muted" style="margin:0">Rank: <b>' + rank + "</b>" + (nextAt ? " · " + (nextAt - xp) + " XP to the next rank" : " · top rank") + ". XP comes from quizzes, sorts, writing, wall posts and boss rounds.</p></div>" +
    '<div class="nums"><div><b class="lab-grad">' + done + '</b><span>of 14 weeks done</span></div><div><b>' + xp + '</b><span>XP earned</span></div><div><b>' + (cur.n) + '</b><span>this week</span></div></div>';

  /* bento of weeks (locked until two days before the week starts) */
  var span = { 1: "w2", 3: "w2", 5: "", 8: "w2", 10: "w2", 12: "w2", 14: "w4" };
  var MODE = L.MODE;
  function drawBento(rev) {
    $("#bento").innerHTML = weeks.map(function (w) {
      var hk = H[w.n] || {};
      var k = "w" + pad(w.n), r = rev && rev[k];
      var open = r ? r.open : Date.now() >= L.unlockTs(k);
      var unlock = r ? r.unlock : L.unlockTs(k);
      var cls = "ltile ltilt " + (span[w.n] || "") + (w.mode === "test" ? " test" : "") + (open ? "" : " locked");
      var inner = '<img src="assets/img/wk' + pad(w.n) + '.jpg" alt="" loading="lazy"><div class="tt"><span class="n">' + pad(w.n) + "</span><strong>" + esc(w.title) + '</strong><span class="a">' + esc(open ? (hk.head || (w.topics || [])[0] || "") : "Opens " + L.fmtUnlock(unlock) + (r && r.override === "locked" ? " · locked by your lecturer" : "")) + '</span><span class="d">' + L.fmtRange(w.start, w.end) + " · " + esc(MODE[w.mode] || "") + (w.flag ? " · " + esc(w.flag) : "") + "</span></div>" +
        (open ? (w.n === cw ? '<span class="sticker">This week</span>' : "") + (weekDone(w.n) ? '<span class="done-mark">Done · ' + weekXp(w.n) + " XP</span>" : (weekXp(w.n) ? '<span class="done-mark" style="background:#fff">' + weekXp(w.n) + " XP</span>" : "")) : '<span class="lock">🔒 ' + L.fmtUnlock(unlock) + "</span>");
      return open ? '<a class="' + cls + '" href="weeks/week-' + pad(w.n) + '.html">' + inner + "</a>" : '<a class="' + cls + '" href="locked.html?week=' + pad(w.n) + '" aria-label="Week ' + w.n + ' opens ' + L.fmtUnlock(unlock) + '">' + inner + "</a>";
    }).join("");
  }
  drawBento(null);
  L.reveal().then(function (rev) { drawBento(rev); L.setupMotion($("#bento")); });

  /* tickers */
  var mq1 = P.report.map(function (p, i) { return '<span class="' + (i % 2 ? "lab-grad" : "") + '">' + esc(p) + "</span>"; }).join("");
  var mq2 = P.talk.map(function (p) { return "<span>" + esc(p) + "</span>"; }).join("");
  $("#mq1").innerHTML = mq1 + mq1; $("#mq2").innerHTML = mq2 + mq2;

  /* assessments */
  $("#assess").innerHTML = C.assessments.map(function (a, i) { return '<div><span class="pc c' + (i + 1) + '">' + a.pct + "%</span><strong>" + esc(a.name) + '</strong><p>' + esc(a.when) + "</p><p>" + esc(a.detail) + "</p></div>"; }).join("");

  /* programme rows */
  $("#prog").innerHTML = C.weeks.map(function (w) {
    var isNum = typeof w.n === "number";
    var cls = w.end < L.TODAY ? "past" : (w.start <= L.TODAY && L.TODAY <= w.end ? "now" : "");
    return '<div class="pr ' + cls + '"><span class="dt">' + (isNum ? "Week " + w.n + " · " : "") + L.fmtRange(w.start, w.end) + (cls === "now" ? " · Now" : "") + "</span><span>" + esc(w.title) + ' <span class="muted small">· ' + esc(MODE[w.mode] || "") + "</span>" + (w.flag ? '<span class="tagx">' + esc(w.flag) + "</span>" : "") + "</span>" + (isNum ? '<a class="go" href="weeks/week-' + pad(w.n) + '.html">Open ›</a>' : "<span></span>") + "</div>";
  }).join("");

  /* leaderboard */
  var lb = $("#lb");
  function drawLb(data) {
    var on = L.store.get("board", false), me = L.deviceId();
    var join = '<div class="lb-join"><p class="eyebrow">' + (on ? "You’re on the board" : "Join the board") + '</p><h3>' + (on ? "Nice. Keep stacking XP." : "Put your nickname up.") + '</h3><p class="muted" style="margin:0;color:var(--dk-muted)">Only your nickname, XP and weeks done are shared. No names, no matric numbers.</p><input id="lbNick" maxlength="30" value="' + esc(L.nick()) + '" aria-label="Nickname"><div class="lchips"><button class="lbtn" type="button" id="lbJoin">' + (on ? "Update my score" : "Join with this nickname") + '</button>' + (on ? '<button class="lchip" type="button" id="lbLeave" style="background:transparent;color:#fff;border-color:var(--dk-line)">Leave</button>' : "") + "</div></div>";
    var rows = data && data.rows ? data.rows : [];
    var list = rows.length ? rows.slice(0, 20).map(function (r) { return '<div class="lb-row' + (r.rank <= 3 ? " top" : "") + (r.id === me ? " me" : "") + '"><span class="rk">' + (r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : "#" + r.rank) + '</span><span>' + esc(r.nick) + (r.id === me ? ' <span class="wk">· you</span>' : "") + '</span><span class="wk">' + r.weeks + " wk</span><span class=\"xp\">" + r.xp + " XP</span></div>"; }).join("") : '<div class="lb-row"><span class="rk">–</span><span class="muted">' + (data ? "Nobody has joined yet. Be first." : "The board lives on the Netlify site.") + "</span><span></span><span></span></div>";
    lb.innerHTML = join + '<div class="lb-list">' + list + (data && data.total > 20 ? '<div class="lb-row"><span class="rk"></span><span class="muted small">' + data.total + " on the board</span><span></span><span></span></div>" : "") + "</div>";
    $("#lbNick").addEventListener("input", function () { L.store.set("nick", $("#lbNick").value.trim()); });
    $("#lbJoin").addEventListener("click", function () { L.store.set("nick", $("#lbNick").value.trim() || L.nick()); L.store.set("board", true); L.syncBoard(true).then(function () { L.burstFrom($("#lbJoin")); refreshLb(); }); });
    var lv = $("#lbLeave"); if (lv) lv.addEventListener("click", function () { L.leaveBoard().then(refreshLb); });
  }
  function refreshLb() { L.loadBoard().then(drawLb).catch(function () { drawLb(null); }); }
  drawLb(null); refreshLb();
  if (L.store.get("board", false)) L.syncBoard(true);

  $("#motionBtn").innerHTML = L.motionBtn();
  $("#resetProg").addEventListener("click", function (e) { e.preventDefault(); if (confirm("Reset your progress, XP and drafts on this device?")) { try { localStorage.removeItem("smb31202.progress.v1"); } catch (x) {} location.reload(); } });

  L.presence("home");
  /* progress backup: merge this student's server copy into this browser (once), then redraw */
  function applyHome(next, info) {
    var cur = {}; try { cur = JSON.parse(localStorage.getItem(L.PKEY) || "{}"); } catch (e) {}
    cur.owner = next.owner;
    if (info.changed) { cur.weeks = next.weeks; cur.checks = next.checks; if (info.switched) cur.drafts = {}; }
    try { localStorage.setItem(L.PKEY, JSON.stringify(cur)); } catch (e) {}
    if (info.changed) { try { var sig = next.owner + ":" + JSON.stringify(next).length; if (sessionStorage.getItem("etc-prog-reload") !== sig) { sessionStorage.setItem("etc-prog-reload", sig); location.reload(); } } catch (e) {} }
  }
  if (L.syncProgress) { L.syncProgress(prog, applyHome); document.addEventListener("lab:identity", function () { var p2 = {}; try { p2 = JSON.parse(localStorage.getItem(L.PKEY) || "{}"); } catch (e) {} L.syncProgress(p2, applyHome); }); }
  L.setupMotion(document);
  $("#main").classList.add("enter");
})();
