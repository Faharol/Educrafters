import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { json, clean, whoAmI, sha, isOwner } from "../lib/shared.mts";

/* Phone remote for the projector screen. Admin password required on both sides,
   so a student who scans the QR on the projector gets nothing.
   Blobs, store "remote":
     s/<id>            session { id, created, expires }
     st/<id>           screen state { title, url, week, sections[], cur, ts } (written by the screen)
     c/<id>/<seq>      one command { cmd, arg, ts } (written by the phone)
   Polling (screen for commands, phone for state) goes through the edge function remote-poll.ts. */

const ID_RE = /^[a-z0-9]{10}$/;
const LIFE = 6 * 3600 * 1000;
const CMDS = new Set(["hello", "next", "prev", "up", "down", "top", "goto", "week", "react", "answers", "timer", "black", "qr", "wall", "clear", "home", "speed"]);
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
  const who = req.headers.get("x-admin-key") ? await whoAmI(req) : null;
  const admin = !!who;
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
      // kept for old pages; polling now goes through the edge function /api/remote-poll (no compute cost)
      return json({ cmds: await cmdsAfter(store, id, after) });
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
    await store.setJSON("s/" + id, { id, token, created: now, expires: now + LIFE, by: who!.id });
    await store.setJSON("latest/" + who!.id, { id, ts: now }); // the watch sends to the lecturer's latest session
    return json({ id, token, expires: now + LIFE });
  }

  /* Apple Watch: a personal watch key (no QR); it can only send remote commands to its owner's latest session */
  if (action === "watchkey") {
    if (!isOwner(who)) return json({ error: "Owner only" }, 403);
    const cfg = getStore({ name: "config", consistency: "strong" });
    const key = Array.from({ length: 28 }, () => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 55)]).join("");
    const forId = clean(body.for, 24) || "owner";
    const list = (((await cfg.get("watchkeys", { type: "json" })) as any[] | null) || []).filter((k) => k.id !== forId);
    list.push({ id: forId, hash: await sha("watch:" + key), created: now });
    await cfg.setJSON("watchkeys", list);
    return json({ key, for: forId });
  }
  if (action === "watch") {
    const cfg = getStore({ name: "config", consistency: "strong" });
    const h = await sha("watch:" + clean(body.key, 40));
    const k = (((await cfg.get("watchkeys", { type: "json" })) as any[] | null) || []).find((x) => x.hash === h);
    if (!k) return json({ error: "Unknown watch key" }, 401);
    const lt = (await store.get("latest/" + k.id, { type: "json" }).catch(() => null)) as any;
    const ses = lt ? await live(store, lt.id) : null;
    if (!ses) return json({ error: "Start the remote on the computer" }, 404);
    const cmd = clean(body.cmd, 10);
    if (cmd && cmd !== "ping") {
      if (!CMDS.has(cmd)) return json({ error: "Unknown command" }, 400);
      const seq = now * 1000 + Math.floor(Math.random() * 1000);
      await store.setJSON(`c/${ses.id}/${seqKey(seq)}`, { seq, cmd, arg: clean(body.arg, 40), ts: now });
    }
    const st = (await store.get("st/" + ses.id, { type: "json" }).catch(() => null)) as any;
    return json({ ok: true, state: st ? { title: st.title, cur: st.cur, total: (st.sections || []).length } : null });
  }

  /* Air gestures (watch as a motion pointer): the motion stream goes through Ably, not Netlify.
     Netlify only hands out short-lived Ably tokens; the Ably key itself stays in the ABLY_KEY env var.
       airtoken  watch key  -> token that may only PUBLISH to its owner's channel
       airsub    staff key  -> token that may only SUBSCRIBE to that lecturer's channel */
  if (action === "airtoken" || action === "airsub") {
    let ownerId = "";
    if (action === "airsub") {
      if (!admin) return json({ error: "Admin password required" }, 401);
      ownerId = who!.id;
    } else {
      const cfg = getStore({ name: "config", consistency: "strong" });
      const h = await sha("watch:" + clean(body.key, 40));
      const k = (((await cfg.get("watchkeys", { type: "json" })) as any[] | null) || []).find((x) => x.hash === h);
      if (!k) return json({ error: "Unknown watch key" }, 401);
      ownerId = k.id;
    }
    const ablyKey = Netlify.env.get("ABLY_KEY") || "";
    const keyName = ablyKey.split(":")[0];
    if (!ablyKey || !keyName) return json({ error: "Air gestures are not set up yet (no ABLY_KEY)." }, 503);
    const channel = "etc-air:" + ownerId.replace(/[^a-zA-Z0-9_-]/g, "");
    const capability = JSON.stringify({ [channel]: action === "airsub" ? ["subscribe"] : ["publish"] });
    const r = await fetch(`https://rest.ably.io/keys/${encodeURIComponent(keyName)}/requestToken`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Basic " + btoa(ablyKey) },
      body: JSON.stringify({ keyName, capability, clientId: (action === "airsub" ? "screen-" : "watch-") + ownerId, ttl: 3 * 3600 * 1000, timestamp: now }),
    });
    const td = (await r.json().catch(() => null)) as any;
    if (!r.ok || !td || !td.token) return json({ error: "Could not get a realtime token", detail: td && td.error ? td.error.message : r.status }, 502);
    return json({ token: td.token, expires: td.expires, issued: td.issued, capability: td.capability, keyName: td.keyName, channel });
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
