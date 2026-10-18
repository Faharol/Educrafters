/* Shared helpers for the ETC Lab functions. Lives outside netlify/functions so it is not deployed as a function. */

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export const clean = (s: unknown, max: number) =>
  String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

/* Lecturer PIN (wall, live round) or the admin password both unlock lecturer actions. */
export const pinOk = (req: Request) => {
  const h = req.headers.get("x-wall-pin") || req.headers.get("x-admin-key") || "";
  const pin = Netlify.env.get("WALL_PIN");
  const admin = Netlify.env.get("ADMIN_PASSWORD");
  return Boolean(h) && ((Boolean(pin) && h === pin) || (Boolean(admin) && h === admin));
};
export const adminOk = (req: Request) => {
  const h = req.headers.get("x-admin-key") || "";
  const admin = Netlify.env.get("ADMIN_PASSWORD");
  return Boolean(admin) && h === admin;
};

export const normMatric = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
export const WEEK_RE = /^w(0[1-9]|1[0-4])$/;
export const DEV_RE = /^[a-z0-9]{8,24}$/;

/* Week start dates (Mondays) from the Scheme of Work, Semester 1 2026/2027. Weeks open 2 days before, at 00:00 Malaysia time. */
export const WEEK_START: Record<string, string> = {
  w01: "2026-10-05", w02: "2026-10-12", w03: "2026-10-19", w04: "2026-10-26", w05: "2026-11-02", w06: "2026-11-09", w07: "2026-11-16",
  w08: "2026-11-23", w09: "2026-12-07", w10: "2026-12-14", w11: "2026-12-21", w12: "2026-12-28", w13: "2027-01-04", w14: "2027-01-11",
};
export const REVEAL_DAYS_BEFORE = 2;
export const MYT_OFFSET_MS = 8 * 3600 * 1000;
export function unlockTs(week: string): number {
  const d = WEEK_START[week]; if (!d) return 0;
  // midnight MYT on (start - 2 days)
  return Date.parse(d + "T00:00:00Z") - MYT_OFFSET_MS - REVEAL_DAYS_BEFORE * 86400000;
}
export type RevealConfig = Record<string, "open" | "locked" | undefined>;
export function isOpen(week: string, cfg: RevealConfig | null, now = Date.now()): boolean {
  const o = cfg && cfg[week];
  if (o === "open") return true;
  if (o === "locked") return false;
  return now >= unlockTs(week);
}
export function mytDate(ts = Date.now()) {
  return new Date(ts + MYT_OFFSET_MS).toISOString().slice(0, 10);
}
export function mytTime(ts = Date.now()) {
  return new Date(ts + MYT_OFFSET_MS).toISOString().slice(11, 16);
}
