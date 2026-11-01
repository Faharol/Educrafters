import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { json, clean, adminOk } from "../lib/shared.mts";

/* Phone remote for the projector screen. Admin password required on both sides,
   so a student who scans the QR on the projector gets nothing.
   Blobs, store "remote":
     s/<id>            session { id, created, expires }
     st/<id>           screen state { title, url, week, sections[], cur, ts } (written by the screen)
     c/<id>/<seq>      one command { cmd, arg, ts } (written by the phone)
   The screen long-polls GET ?wait=<id>&after=<seq> (returns as soon as a command lands, or after ~7 s). */

const ID_RE = /^[a-z0-9]{10}$/;
const LIFE = 6 * 3600 * 1000;
const CMDS = new Set(["hello", "next", "prev", "up", "down", "top", "goto", "week", "react", "answers", "timer", "black", "qr", "wall", "clear", "home"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const seqKey = (n: number) => String(n).padStart(13, "0");

async function live(store: any, id: string) {
  if (!ID_RE.test(id)) return null;
  const s = (await store.get("s/" + id, { type: "json" }).catch(() => null)) as any;
  return s && s.expires > Date.now() ? s : null;
}
async function cmdsAfter(store: any, id: string, after: number) {
  const { blobs } = await store.list({ prefix: `c/${id}/` });
  const keys = blobs.map((b: any) => b.key).filter((k: string) => Number(k.split("/").pop()) > after).sort();
  if (!keys.length) return [];
  return (await Promise.all(keys.slice(0, 20).map((k: string) => store.get(k, { type: "json" }).catch(() => null)))).filter(Boolean);
}

/* the phone proves itself with the session token carried in the QR (no password to type);
   the computer proves itself with the admin password */
function tokenOk(req: Request, s: any) { const t = req.headers.get("x-remote-token") || ""; return !!(s && s.token && t && t === s.token); }

export default async (req: Request) => {
  const admin = adminOk(req);
  const store = getStore({ name: "remote", consistency: "strong" });
  const url = new URL(req.url);
  const now = Date.now();

  if (req.method === "GET") {
    // phone: current screen state
    if (url.searchParams.has("state")) {
      const id = clean(url.searchParams.get("state"), 12);
      const ses = await live(store, id);
      if (ses && !admin && !tokenOk(req, ses)) return json({ error: "Scan the QR code on the computer again." }, 401);
      if (!ses) return json({ error: "This remote session has ended. Start a new one on the computer." }, 404);
      const st = (await store.get("st/" + id, { type: "json" }).catch(() => null)) as any;
      return json({ state: st || null, now });
    }
    // screen: wait for commands
    if (url.searchParams.has("wait")) {
      if (!admin) return json({ error: "Admin password required" }, 401);
      const id = clean(url.searchParams.get("wait"), 12);
      const after = Number(url.searchParams.get("after")) || 0;
      if (!(await live(store, id))) return json({ error: "ended", ended: true }, 404);
      const until = now + 7000;
      while (Date.now() < until) {
        const c = await cmdsAfter(store, id, after);
        if (c.length) return json({ cmds: c });
        await sleep(300);
      }
      return json({ cmds: [] });
    }
    return json({ error: "Unknown query" }, 400);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = clean(body.action, 10);

  if (action === "start") {
    if (!admin) return json({ error: "Admin password required" }, 401);
    const token = Array.from({ length: 16 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
    const id = Array.from({ length: 10 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
    await store.setJSON("s/" + id, { id, token, created: now, expires: now + LIFE });
    return json({ id, token, expires: now + LIFE });
  }

  const id = clean(body.id, 12);
  const ses = await live(store, id);
  if (!ses) return json({ error: "This remote session has ended. Start a new one on the computer." }, 404);
  if (!admin && !(tokenOk(req, ses) && (action === "cmd" || action === "end"))) return json({ error: "Scan the QR code on the computer again." }, 401);

  if (action === "state") {
    const st = body.state && typeof body.state === "object" ? body.state : {};
    const sections = Array.isArray(st.sections) ? st.sections.slice(0, 120).map((t: any) => clean(t, 80)) : [];
    await store.setJSON("st/" + id, { title: clean(st.title, 120), url: clean(st.url, 200), week: clean(st.week, 3), sections, cur: Math.max(0, Number(st.cur) || 0), timer: Number(st.timer) || 0, black: !!st.black, ts: now });
    return json({ ok: true });
  }

  if (action === "cmd") {
    const cmd = clean(body.cmd, 10);
    if (!CMDS.has(cmd)) return json({ error: "Unknown command" }, 400);
    const seq = now * 1000 + Math.floor(Math.random() * 1000);
    await store.setJSON(`c/${id}/${seqKey(seq)}`, { seq, cmd, arg: clean(body.arg, 40), ts: now });
    return json({ ok: true, seq });
  }

  if (action === "end") {
    await store.delete("s/" + id);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
};

export const config: Config = { path: "/api/remote" };
