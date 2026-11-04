import type { Config, Context } from "@netlify/edge-functions";
import { getStore } from "@netlify/blobs";

/* Reveal gate: a week page opens 2 days before its Monday (00:00 Malaysia time),
   unless the admin overrides it (store "config", key "reveal": { w03: "open" | "locked" }).
   Lecturers (owner or any lecturer login) pass with the cookie set by admin.html. */

const WEEK_START: Record<string, string> = {
  w01: "2026-10-05", w02: "2026-10-12", w03: "2026-10-19", w04: "2026-10-26", w05: "2026-11-02", w06: "2026-11-09", w07: "2026-11-16",
  w08: "2026-11-23", w09: "2026-12-07", w10: "2026-12-14", w11: "2026-12-21", w12: "2026-12-28", w13: "2027-01-04", w14: "2027-01-11",
};
const MYT = 8 * 3600 * 1000;
const unlockTs = (w: string) => Date.parse(WEEK_START[w] + "T00:00:00Z") - MYT - 2 * 86400000;


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

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const m = url.pathname.match(/\/weeks\/week-(\d\d)\.html$/);
  if (!m) return;
  const week = "w" + m[1];
  if (!WEEK_START[week]) return;
  const cookie = req.headers.get("cookie") || "";
  const ck = cookie.split(/;\s*/).find((c) => c.startsWith("etc_admin="));
  if (ck) { let v = ""; try { v = decodeURIComponent(ck.slice(10)); } catch { /* bad cookie */ } if (await staffKey(v)) return; }
  let override: string | undefined;
  try {
    const store = getStore({ name: "config", consistency: "strong" });
    const cfg = (await store.get("reveal", { type: "json" })) as Record<string, string> | null;
    override = cfg ? cfg[week] : undefined;
  } catch { /* if Blobs is unreachable, fall back to the schedule */ }
  const open = override === "open" ? true : override === "locked" ? false : Date.now() >= unlockTs(week);
  if (open) return;
  return Response.redirect(new URL("/locked.html?week=" + m[1], url), 302);
};

export const config: Config = { path: "/weeks/*" };
