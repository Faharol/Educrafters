import type { Config } from "@netlify/edge-functions";
import { getStore } from "@netlify/blobs";

/* Cheap polling for the phone remote. Edge Functions are billed as web requests only
   (no compute time), so the screen can check every second for very little.
   GET ?wait=<id>&after=<seq>   computer (admin password)  -> new commands
   GET ?state=<id>              phone (QR token) or admin   -> what the screen shows */

const ID_RE = /^[a-z0-9]{10}$/;
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });


/* owner password or any lecturer password (config/lecturers holds sha256("etc:" + password)) */
async function staffKey(key: string): Promise<boolean> {
  if (!key) return false;
  const admin = Netlify.env.get("ADMIN_PASSWORD") || "";
  if (admin && key === admin) return true;
  try {
    const list = ((await getStore({ name: "config", consistency: "strong" }).get("lecturers", { type: "json" })) as any[] | null) || [];
    if (!list.length) return false;
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("etc:" + key));
    const h = Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return list.some((l) => l && l.hash === h);
  } catch { return false; }
}

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(req.url);
  const store = getStore({ name: "remote", consistency: "strong" });
  const admin = await staffKey(req.headers.get("x-admin-key") || "");
  const id = String(url.searchParams.get("wait") || url.searchParams.get("state") || "").slice(0, 12);
  if (!ID_RE.test(id)) return json({ error: "Bad request" }, 400);
  const s = (await store.get("s/" + id, { type: "json" }).catch(() => null)) as any;
  const live = s && s.expires > Date.now();

  if (url.searchParams.has("wait")) {
    if (!admin) return json({ error: "Admin password required" }, 401);
    if (!live) return json({ error: "ended", ended: true }, 404);
    const after = Number(url.searchParams.get("after")) || 0;
    const { blobs } = await store.list({ prefix: `c/${id}/` });
    const keys = blobs.map((b: any) => b.key).filter((k: string) => Number(k.split("/").pop()) > after).sort().slice(0, 20);
    const cmds = keys.length ? (await Promise.all(keys.map((k: string) => store.get(k, { type: "json" }).catch(() => null)))).filter(Boolean) : [];
    return json({ cmds });
  }

  // phone: screen state
  if (live && !admin && !(s.token && req.headers.get("x-remote-token") === s.token)) return json({ error: "Scan the QR code on the computer again." }, 401);
  if (!live) return json({ error: "This remote session has ended. Start a new one on the computer." }, 404);
  const st = (await store.get("st/" + id, { type: "json" }).catch(() => null)) as any;
  return json({ state: st || null, now: Date.now() });
};

export const config: Config = { path: "/api/remote-poll" };
