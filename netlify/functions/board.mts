import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

/* Opt-in XP leaderboard. One blob per device: "xp/<deviceId>" = { nick, xp, weeks, ts }.
   Students opt in on the home page; their device then posts its XP total after each award. */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const ID_RE = /^[a-z0-9]{8,24}$/;
const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);

export default async (req: Request) => {
  const store = getStore({ name: "leaderboard", consistency: "strong" });
  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "xp/" });
    const rows = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean) as any[];
    rows.sort((a, b) => b.xp - a.xp || a.ts - b.ts);
    return json({ rows: rows.slice(0, 50).map((r, i) => ({ rank: i + 1, id: r.id, nick: r.nick, xp: r.xp, weeks: r.weeks })), total: rows.length });
  }
  if (req.method === "POST") {
    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const id = clean(body.id, 24);
    if (!ID_RE.test(id)) return json({ error: "Bad id" }, 400);
    const nick = clean(body.nick, 30) || "anonymous";
    const xp = Math.max(0, Math.min(100000, Math.round(Number(body.xp) || 0)));
    const weeks = Math.max(0, Math.min(14, Math.round(Number(body.weeks) || 0)));
    if (body.leave) { await store.delete("xp/" + id); return json({ ok: true, left: true }); }
    await store.setJSON("xp/" + id, { id, nick, xp, weeks, ts: Date.now() });
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = { path: "/api/board" };
