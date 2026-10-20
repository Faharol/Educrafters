import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { json, clean, adminOk, normMatric, WEEK_RE, DEV_RE, isOpen, mytDate, type RevealConfig } from "../lib/shared.mts";

/* Student tracking: identify (matric), presence heartbeats, live writing, attendance.
   Blobs, store "track":
     pres/<device>                     latest heartbeat { device, nick, matric, name, section, page, ts, sid }
     sess/<sid>                        marks a session start (so each visit is logged once)
     visit/<YYYY-MM-DD>/<ts>-<device>  visit log { device, nick, matric, name, section, page, ts }
     w/<week>/<device>/<pad>           latest text of a write pad { ..., text, words, ts }
     wh/<week>/<device>/<pad>/<ts>     snapshot (at most one per 3 minutes)
     att/<week>/<matricKey>            attendance { week, matric, name, section, device, ts, summary }
     id/<device>                       identity on that device { matric, name, section, ts }
   Roster lives in store "config" key "roster" (imported from the admin page). */

type Entry = { matric: string; key: string; name: string; programme: string; section: string; slot: string };
const ONLINE_MS = 90 * 1000;
const LIGHT_SHARE = 0.7; // keep in step with deck.js

async function roster(): Promise<Entry[]> {
  const cfg = getStore({ name: "config", consistency: "strong" });
  return ((await cfg.get("roster", { type: "json" })) as Entry[] | null) || [];
}
async function lookup(matric: string): Promise<Entry | null> {
  const key = normMatric(matric); if (!key) return null;
  return (await roster()).find((r) => r.key === key) || null;
}
async function revealCfg(): Promise<RevealConfig> {
  const cfg = getStore({ name: "config", consistency: "strong" });
  return ((await cfg.get("reveal", { type: "json" })) as RevealConfig | null) || {};
}
async function listJson(store: any, prefix: string) {
  const { blobs } = await store.list({ prefix });
  return (await Promise.all(blobs.map((b: any) => store.get(b.key, { type: "json" }).then((v: any) => v && Object.assign(v, { _key: b.key })).catch(() => null)))).filter(Boolean) as any[];
}


/* same merge rules as lab.js: union of done / read / seen, highest XP per activity, attendance kept */
function mergeWeek(a: any, b: any) {
  a = a || {}; b = b || {};
  const uni = (x: any[], y: any[]) => { const r = Array.isArray(x) ? x.slice(0, 400) : []; (Array.isArray(y) ? y : []).slice(0, 400).forEach((v) => { if (!r.includes(v)) r.push(v); }); return r; };
  const orMap = (x: any, y: any) => { const r: Record<string, number> = {}; [x || {}, y || {}].forEach((m: any) => { Object.keys(m).slice(0, 600).forEach((k) => { if (m[k]) r[String(k).slice(0, 80)] = 1; }); }); return r; };
  const maxMap = (x: any, y: any) => { const r: Record<string, number> = {}; [x || {}, y || {}].forEach((m: any) => { Object.keys(m).slice(0, 600).forEach((k) => { const kk = String(k).slice(0, 80); r[kk] = Math.max(r[kk] || 0, Math.min(1000, Number(m[k]) || 0)); }); }); return r; };
  const o: any = { seen: uni(a.seen, b.seen), earned: maxMap(a.earned, b.earned), done: orMap(a.done, b.done), viewed: orMap(a.viewed, b.viewed),
    scroll: Math.max(Number(a.scroll) || 0, Number(b.scroll) || 0), total: Math.max(Number(a.total) || 0, Number(b.total) || 0), last: Math.max(Number(a.last) || 0, Number(b.last) || 0) };
  const at = a.attended || b.attended; if (at && typeof at === "object") o.attended = { ts: Number(at.ts) || 0, name: String(at.name || "").slice(0, 80), matric: String(at.matric || "").slice(0, 16) };
  return o;
}
function mergeProgress(a: any, b: any) {
  const w: Record<string, any> = {};
  const keys = new Set([...Object.keys(a.weeks || {}), ...Object.keys(b.weeks || {})].filter((k) => /^\d\d$/.test(k)));
  keys.forEach((k) => { w[k] = mergeWeek((a.weeks || {})[k], (b.weeks || {})[k]); });
  const c: Record<string, boolean> = {};
  [a.checks || {}, b.checks || {}].forEach((m: any) => Object.keys(m).slice(0, 1000).forEach((k) => { if (m[k]) c[String(k).slice(0, 80)] = true; }));
  return { weeks: w, checks: c };
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const store = getStore({ name: "track", consistency: "strong" });

  /* ---------- admin reads ---------- */
  if (req.method === "GET") {
    if (!adminOk(req)) return json({ error: "Admin password required" }, 401);
    const now = Date.now();
    if (url.searchParams.has("online")) {
      const all = await listJson(store, "pres/");
      const online = all.filter((p) => now - p.ts < ONLINE_MS).sort((a, b) => b.ts - a.ts);
      return json({ now, count: online.length, online: online.map((p) => ({ device: p.device, nick: p.nick, matric: p.matric || "", name: p.name || "", section: p.section || "", page: p.page, ts: p.ts, since: p.since || p.ts })) });
    }
    if (url.searchParams.has("visits")) {
      const day = clean(url.searchParams.get("visits"), 10) || mytDate(now);
      const v = await listJson(store, "visit/" + day + "/");
      v.sort((a, b) => a.ts - b.ts);
      return json({ day, count: v.length, visits: v.map((x) => ({ device: x.device, nick: x.nick, matric: x.matric || "", name: x.name || "", section: x.section || "", page: x.page, ts: x.ts })) });
    }
    if (url.searchParams.has("writing")) {
      const week = clean(url.searchParams.get("writing"), 3);
      if (!WEEK_RE.test(week)) return json({ error: "Bad week" }, 400);
      const w = await listJson(store, "w/" + week + "/");
      w.sort((a, b) => b.ts - a.ts);
      return json({ now, week, count: w.length, writing: w.map((x) => ({ device: x.device, pad: x.pad, label: x.label, nick: x.nick, matric: x.matric || "", name: x.name || "", section: x.section || "", text: x.text, words: x.words, ts: x.ts })) });
    }
    if (url.searchParams.has("history")) {
      const week = clean(url.searchParams.get("week"), 3), device = clean(url.searchParams.get("device"), 24), pad = clean(url.searchParams.get("pad"), 24);
      if (!WEEK_RE.test(week) || !DEV_RE.test(device) || !pad) return json({ error: "Bad request" }, 400);
      const h = await listJson(store, `wh/${week}/${device}/${pad}/`);
      h.sort((a, b) => a.ts - b.ts);
      return json({ history: h.map((x) => ({ ts: x.ts, words: x.words, text: x.text })) });
    }
    if (url.searchParams.has("attendance")) {
      const week = clean(url.searchParams.get("attendance"), 3);
      if (!WEEK_RE.test(week)) return json({ error: "Bad week" }, 400);
      const att = await listJson(store, "att/" + week + "/");
      const ros = await roster();
      const byKey: Record<string, any> = {}; att.forEach((a) => { byKey[a.key] = a; });
      const rows = ros.map((r) => { const a = byKey[r.key]; return { matric: r.matric, name: r.name, section: r.section, present: !!a, manual: false, ts: a ? a.ts : null, xp: a ? a.summary?.xp : null, done: a ? a.summary?.done : null, total: a ? a.summary?.total : null }; });
      const extra = att.filter((a) => !ros.some((r) => r.key === a.key)).map((a) => ({ matric: a.matric, name: a.name || "(no name)", section: a.section || "", present: true, manual: true, ts: a.ts, xp: a.summary?.xp, done: a.summary?.done, total: a.summary?.total }));
      const all = extra.concat(rows);
      const sections: Record<string, { present: number; total: number; manual: number }> = {};
      all.forEach((r) => { const s = sections[r.section || "(no section)"] || (sections[r.section || "(no section)"] = { present: 0, total: 0, manual: 0 }); s.total++; if (r.present) s.present++; if (r.manual) s.manual++; });
      return json({ week, rows: all, sections, present: att.length, manual: extra.length, total: ros.length });
    }
    if (url.searchParams.has("attendance-all")) {
      const out: Record<string, number> = {};
      for (let n = 1; n <= 14; n++) { const w = "w" + String(n).padStart(2, "0"); const { blobs } = await store.list({ prefix: "att/" + w + "/" }); out[w] = blobs.length; }
      return json({ counts: out, roster: (await roster()).length });
    }
    if (url.searchParams.has("reset-attendance")) {
      const week = clean(url.searchParams.get("reset-attendance"), 3), matric = normMatric(url.searchParams.get("matric"));
      if (!WEEK_RE.test(week) || !matric) return json({ error: "Bad request" }, 400);
      await store.delete(`att/${week}/${matric}`);
      return json({ ok: true });
    }
    return json({ error: "Unknown query" }, 400);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = clean(body.action, 12);
  const device = clean(body.device, 24);
  if (!DEV_RE.test(device)) return json({ error: "Bad device id" }, 400);
  const now = Date.now();

  if (action === "identify") {
    const e = await lookup(body.matric);
    if (!e) return json({ error: "That matric number is not on the class list.", notFound: true }, 404);
    await store.setJSON("id/" + device, { matric: e.matric, key: e.key, name: e.name, section: e.section, ts: now });
    return json({ matric: e.matric, name: e.name, section: e.section, slot: e.slot });
  }

  const nick = clean(body.nick, 30) || "anonymous";
  const matric = clean(body.matric, 16), name = clean(body.name, 80), section = clean(body.section, 60);
  const page = clean(body.page, 12) || "home";

  if (action === "heartbeat") {
    const sid = clean(body.sid, 24);
    let since = Number(body.since) || now;
    if (sid && DEV_RE.test(sid)) {
      const seen = (await store.getMetadata("sess/" + sid).catch(() => null)) as any;
      if (!seen) {
        const vkey = `visit/${mytDate(now)}/${now}-${device}`;
        await store.set("sess/" + sid, "1", { metadata: { ts: now, vkey, named: name ? 1 : 0 } });
        await store.setJSON(vkey, { device, nick, matric, name, section, page, ts: now });
        since = now;
      } else if (name && seen.metadata && seen.metadata.vkey && !seen.metadata.named) {
        // the student identified after the visit started: put their name on that visit
        const v = (await store.get(seen.metadata.vkey, { type: "json" }).catch(() => null)) as any;
        if (v) { v.matric = matric; v.name = name; v.section = section; await store.setJSON(seen.metadata.vkey, v); }
        await store.set("sess/" + sid, "1", { metadata: Object.assign({}, seen.metadata, { named: 1 }) });
      }
    }
    await store.setJSON("pres/" + device, { device, nick, matric, name, section, page, ts: now, sid, since });
    return json({ ok: true });
  }

  if (action === "writing") {
    const week = clean(body.week, 3), pad = clean(body.pad, 24).replace(/[^a-z0-9_-]/gi, "");
    if (!WEEK_RE.test(week) || !pad) return json({ error: "Bad request" }, 400);
    const text = String(body.text || "").slice(0, 6000);
    const words = (text.trim().match(/\S+/g) || []).length;
    const key = `w/${week}/${device}/${pad}`;
    const prev = (await store.get(key, { type: "json" }).catch(() => null)) as any;
    const rec = { device, pad, label: clean(body.label, 80), nick, matric, name, section, week, text, words, ts: now, snap: prev && prev.snap ? prev.snap : 0 };
    if (!prev || now - (prev.snap || 0) > 3 * 60 * 1000) {
      await store.setJSON(`wh/${week}/${device}/${pad}/${now}`, { ts: now, words, text });
      rec.snap = now;
    }
    await store.setJSON(key, rec);
    return json({ ok: true, ts: now });
  }

  if (action === "progress") {
    // backup of a student's progress, keyed by matric; merged so no device can wipe another's
    const key = normMatric(body.matric);
    if (!key || !(/^\d{9}\d?$/.test(key) || (await lookup(body.matric)))) return json({ error: "Bad matric" }, 400);
    const pkey = "prog/" + key;
    const stored = ((await store.get(pkey, { type: "json" }).catch(() => null)) as any) || null;
    let merged = stored ? { weeks: stored.weeks || {}, checks: stored.checks || {} } : { weeks: {}, checks: {} };
    if (body.progress && typeof body.progress === "object") {
      const raw = JSON.stringify(body.progress);
      if (raw.length > 200000) return json({ error: "Progress too large" }, 413);
      const inc = { weeks: (body.progress.weeks && typeof body.progress.weeks === "object") ? body.progress.weeks : {}, checks: (body.progress.checks && typeof body.progress.checks === "object") ? body.progress.checks : {} };
      const next = mergeProgress(merged, inc);
      if (JSON.stringify(next) !== JSON.stringify(merged)) { merged = next; await store.setJSON(pkey, { ...merged, ts: now, device }); }
    }
    return json({ progress: merged });
  }

  if (action === "attend") {
    const week = clean(body.week, 3);
    if (!WEEK_RE.test(week)) return json({ error: "Bad week" }, 400);
    if (!isOpen(week, await revealCfg(), now)) return json({ error: "This week is not open yet." }, 423);
    let e = await lookup(body.matric);
    let manual = false;
    if (!e) {
      // not on the roster: allow a manual record if the student gives a name and section; it is flagged for the lecturer
      const mm = clean(body.matric, 16), mn = clean(body.manualName, 80), ms = clean(body.manualSection, 60);
      if (!/^\d{9}(-\d)?$/.test(mm.replace(/\s/g, ""))) return json({ error: "That matric number is not on the class list, and it does not look like a matric number." }, 404);
      if (!body.manual || mn.length < 3 || !ms) return json({ error: "That matric number is not on the class list.", notFound: true }, 404);
      e = { matric: mm.replace(/\s/g, ""), key: normMatric(mm), name: mn.toUpperCase(), programme: "", section: ms, slot: "" };
      manual = true;
    }
    const s = body.summary || {};
    const n = (v: any) => Math.max(0, Math.round(Number(v) || 0));
    const summary = { xp: n(s.xp), done: n(s.done), total: n(s.total), coreDone: n(s.coreDone), coreTotal: n(s.coreTotal), lightDone: n(s.lightDone), lightTotal: n(s.lightTotal), scroll: Math.max(0, Math.min(100, Math.round(Number(s.scroll) || 0))), missing: Array.isArray(s.missing) ? s.missing.slice(0, 30).map((x: any) => clean(x, 60)) : [] };
    // rule: every write pad, the wall post and the boss round (core), plus 70% of the small activities
    if (summary.coreTotal || summary.lightTotal) {
      if (summary.coreDone < summary.coreTotal) return json({ error: "Finish the writing tasks, the wall post and the boss round first. " + (summary.coreTotal - summary.coreDone) + " left." }, 412);
      const lightNeed = Math.ceil(summary.lightTotal * LIGHT_SHARE);
      if (summary.lightDone < lightNeed) return json({ error: "Do " + (lightNeed - summary.lightDone) + " more small activities first." }, 412);
    } else if (summary.total && summary.done < summary.total) return json({ error: "Finish every activity first. " + (summary.total - summary.done) + " left." }, 412);
    if (summary.scroll < 97) return json({ error: "Scroll through the whole week first." }, 412);
    const key = `att/${week}/${e.key}`;
    const prev = (await store.get(key, { type: "json" }).catch(() => null)) as any;
    if (prev) return json({ ok: true, already: true, ts: prev.ts, name: e.name, week });
    const rec = { week, matric: e.matric, key: e.key, name: e.name, section: e.section, device, nick, ts: now, summary, manual };
    await store.setJSON(key, rec);
    await store.setJSON("id/" + device, { matric: e.matric, key: e.key, name: e.name, section: e.section, ts: now, manual });
    return json({ ok: true, ts: now, name: e.name, section: e.section, week, manual });
  }

  return json({ error: "Unknown action" }, 400);
};

export const config: Config = { path: "/api/track" };
