import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { createHmac, randomBytes } from "node:crypto";
import { json, clean, normMatric, WEEK_RE, DEV_RE, whoAmI, canSee } from "../lib/shared.mts";

/* QR attendance per class (section).
   Only the lecturer (admin password) can start a session and see the QR.
   The QR carries a code that changes every 10 s (HMAC of the session secret and the time step);
   a scan is accepted for the current or previous step, so a photo forwarded on WhatsApp is stale.
   A valid scan gets a ticket bound to that phone (3 minutes) to fill in the matric number.
   One phone records one matric per session. Students not on the class list can add their name (flagged manual).
   Blobs, store "qatt":
     s/<id>                session { id, secret, section, week, created, expires, open }
     r/<id>/<matricKey>    record  { matric, name, section, manual, other, device, ts }
     d/<id>/<device>       which matric this phone recorded */

const STEP = 10_000;
const TICKET_MS = 3 * 60_000;
const LIFE = 3 * 3600_000;
const ID_RE = /^[a-z0-9]{10}$/;
type Entry = { matric: string; key: string; name: string; programme: string; section: string; slot: string };

const hmac = (secret: string, msg: string) => createHmac("sha256", secret).update(msg).digest("base64url");
const codeAt = (s: any, step: number) => hmac(s.secret, "c:" + step).slice(0, 10);
const ticketFor = (s: any, device: string, ts: number) => hmac(s.secret, "t:" + device + ":" + ts).slice(0, 22);

async function roster(): Promise<Entry[]> {
  const cfg = getStore({ name: "config", consistency: "strong" });
  return ((await cfg.get("roster", { type: "json" })) as Entry[] | null) || [];
}
async function listJson(store: any, prefix: string) {
  const { blobs } = await store.list({ prefix });
  return (await Promise.all(blobs.map((b: any) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean) as any[];
}
async function getSess(store: any, id: string) {
  if (!ID_RE.test(id)) return null;
  return (await store.get("s/" + id, { type: "json" }).catch(() => null)) as any;
}
const isLive = (s: any, now: number) => s && s.open && now < s.expires;

export default async (req: Request) => {
  const store = getStore({ name: "qatt", consistency: "strong" });
  const url = new URL(req.url);
  const now = Date.now();
  const who = req.headers.get("x-admin-key") ? await whoAmI(req) : null;
  const admin = !!who;
  const mineS = (s: any) => !!s && canSee(who, s.section); // a lecturer handles only their own classes

  if (req.method === "GET") {
    if (!admin) return json({ error: "Admin password required" }, 401);
    // the lecturer's screen: current QR code + live count
    if (url.searchParams.has("live")) {
      const s = await getSess(store, clean(url.searchParams.get("live"), 12));
      if (!mineS(s)) return json({ error: "No such session" }, 404);
      const step = Math.floor(now / STEP);
      const recs = await listJson(store, `r/${s.id}/`);
      recs.sort((a, b) => b.ts - a.ts);
      const total = (await roster()).filter((r) => r.section === s.section).length;
      return json({ open: isLive(s, now), section: s.section, week: s.week, code: codeAt(s, step), nextIn: STEP - (now % STEP), present: recs.length, total,
        recent: recs.slice(0, 8).map((r) => ({ name: r.name, manual: !!r.manual, other: !!r.other })) });
    }
    if (url.searchParams.has("sessions")) {
      const all = (await listJson(store, "s/")).filter(mineS);
      all.sort((a, b) => b.created - a.created);
      const out = await Promise.all(all.slice(0, 60).map(async (s) => { const { blobs } = await store.list({ prefix: `r/${s.id}/` }); return { id: s.id, section: s.section, week: s.week, created: s.created, open: isLive(s, now), present: blobs.length }; }));
      return json({ sessions: out });
    }
    if (url.searchParams.has("records")) {
      const s = await getSess(store, clean(url.searchParams.get("records"), 12));
      if (!mineS(s)) return json({ error: "No such session" }, 404);
      const recs = await listJson(store, `r/${s.id}/`);
      const byKey: Record<string, any> = {}; recs.forEach((r) => { byKey[normMatric(r.matric)] = r; });
      const ros = (await roster()).filter((r) => r.section === s.section);
      const rows = ros.map((r) => { const a = byKey[r.key]; return { matric: r.matric, name: r.name, section: r.section, present: !!a, ts: a ? a.ts : null, manual: false, other: false }; });
      const extra = recs.filter((r) => !ros.some((x) => x.key === normMatric(r.matric))).map((r) => ({ matric: r.matric, name: r.name, section: r.section, present: true, ts: r.ts, manual: !!r.manual, other: !!r.other }));
      return json({ session: { id: s.id, section: s.section, week: s.week, created: s.created, open: isLive(s, now) }, rows: extra.concat(rows), present: recs.length, total: ros.length });
    }
    return json({ error: "Unknown query" }, 400);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = clean(body.action, 10);

  /* ---------- lecturer ---------- */
  if (action === "start" || action === "stop" || action === "undo" || action === "delete") {
    if (!admin) return json({ error: "Admin password required" }, 401);
    if (action === "start") {
      const section = clean(body.section, 60), week = clean(body.week, 3);
      if (!section) return json({ error: "Choose a class" }, 400);
      if (!canSee(who, section)) return json({ error: "That is not one of your classes." }, 403);
      if (week && !WEEK_RE.test(week)) return json({ error: "Bad week" }, 400);
      const id = Array.from(randomBytes(10)).map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
      await store.setJSON("s/" + id, { id, secret: randomBytes(24).toString("base64url"), section, week, created: now, expires: now + LIFE, open: true });
      return json({ id });
    }
    const s = await getSess(store, clean(body.s, 12));
    if (!mineS(s)) return json({ error: "No such session" }, 404);
    if (action === "stop") { s.open = false; await store.setJSON("s/" + s.id, s); return json({ ok: true }); }
    if (action === "delete") {
      const { blobs } = await store.list({ prefix: `r/${s.id}/` });
      if (blobs.length) return json({ error: "This class has attendance records. Undo them first." }, 409);
      await store.delete("s/" + s.id); return json({ ok: true });
    }
    const key = normMatric(body.matric); if (!key) return json({ error: "Bad matric" }, 400);
    const r = (await store.get(`r/${s.id}/${key}`, { type: "json" }).catch(() => null)) as any;
    await store.delete(`r/${s.id}/${key}`);
    if (r && r.device) await store.delete(`d/${s.id}/${r.device}`);
    return json({ ok: true });
  }

  /* ---------- student ---------- */
  const device = clean(body.device, 24);
  if (!DEV_RE.test(device)) return json({ error: "Open this page from the QR code." }, 400);
  const s = await getSess(store, clean(body.s, 12));
  if (!s || !isLive(s, now)) return json({ error: "Attendance for this class is closed." }, 410);

  if (action === "check") {
    const c = clean(body.c, 12), step = Math.floor(now / STEP);
    if (!c || (c !== codeAt(s, step) && c !== codeAt(s, step - 1))) return json({ error: "This QR has expired. Scan the QR on the screen again.", expired: true }, 403);
    const done = (await store.get(`d/${s.id}/${device}`, { type: "json" }).catch(() => null)) as any;
    return json({ ticket: ticketFor(s, device, now), ts: now, section: s.section, week: s.week, already: done ? { name: done.name, matric: done.matric } : null });
  }

  if (action === "mark") {
    const ts = Number(body.ts) || 0;
    if (!ts || now - ts > TICKET_MS || clean(body.ticket, 30) !== ticketFor(s, device, ts)) return json({ error: "Too slow. Scan the QR on the screen again.", expired: true }, 403);
    const raw = clean(body.matric, 16).replace(/\s/g, ""), key = normMatric(raw);
    if (!key) return json({ error: "Type your matric number." }, 400);
    const mine = (await store.get(`d/${s.id}/${device}`, { type: "json" }).catch(() => null)) as any;
    if (mine && mine.key !== key) return json({ error: "This phone has already recorded " + mine.name + ". Each student uses their own phone." }, 409);
    let e = (await roster()).find((r) => r.key === key) || null, manual = false;
    if (!e) {
      const name = clean(body.name, 80), section = clean(body.section, 60) || s.section;
      if (!/^\d{9}(-\d)?$/.test(raw)) return json({ error: "That matric number is not on the class list, and it does not look like a matric number." }, 404);
      if (!body.manual || name.length < 3) return json({ error: "That matric number is not on the class list.", notFound: true }, 404);
      e = { matric: raw, key, name: name.toUpperCase(), programme: "", section, slot: "" }; manual = true;
    }
    const rkey = `r/${s.id}/${key}`;
    const prev = (await store.get(rkey, { type: "json" }).catch(() => null)) as any;
    if (prev) return json({ ok: true, already: true, name: prev.name, section: prev.section, ts: prev.ts });
    const rec = { matric: e.matric, name: e.name, section: e.section, manual, other: !manual && e.section !== s.section, device, ts: now };
    await store.setJSON(rkey, rec);
    await store.setJSON(`d/${s.id}/${device}`, { key, matric: e.matric, name: e.name });
    return json({ ok: true, name: e.name, section: e.section, matric: e.matric, manual, other: rec.other, ts: now });
  }
  return json({ error: "Unknown action" }, 400);
};

export const config: Config = { path: "/api/qatt" };
