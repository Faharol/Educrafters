import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { json, clean, adminOk, normMatric, WEEK_RE, WEEK_START, unlockTs, isOpen, type RevealConfig } from "../lib/shared.mts";

/* Admin API: login check, roster import, reveal schedule.
   Blobs: store "config": "reveal" (overrides), "roster" (array), "roster-index" (normalised matric -> entry). */

export default async (req: Request) => {
  const url = new URL(req.url);
  const config = getStore({ name: "config", consistency: "strong" });

  if (req.method === "GET") {
    // public: reveal state for the home page and week pages
    if (url.searchParams.has("reveal")) {
      const cfg = ((await config.get("reveal", { type: "json" })) as RevealConfig | null) || {};
      const now = Date.now();
      const weeks: Record<string, { open: boolean; unlock: number; override: string | null }> = {};
      for (const w of Object.keys(WEEK_START)) weeks[w] = { open: isOpen(w, cfg, now), unlock: unlockTs(w), override: cfg[w] || null };
      return json({ now, weeks });
    }
    if (!adminOk(req)) return json({ error: "Admin password required" }, 401);
    if (url.searchParams.has("roster")) {
      const roster = ((await config.get("roster", { type: "json" })) as any[] | null) || [];
      return json({ roster, count: roster.length });
    }
    return json({ ok: true });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = clean(body.action, 16);

  if (action === "login") {
    const pw = Netlify.env.get("ADMIN_PASSWORD");
    if (!pw) return json({ error: "ADMIN_PASSWORD is not set on the site yet." }, 503);
    if (clean(body.password, 64) !== pw) return json({ error: "Wrong password" }, 401);
    return json({ ok: true });
  }
  if (!adminOk(req)) return json({ error: "Admin password required" }, 401);

  if (action === "reveal") {
    const week = clean(body.week, 3);
    if (!WEEK_RE.test(week)) return json({ error: "Bad week" }, 400);
    const mode = clean(body.mode, 8); // open | locked | auto
    const cfg = ((await config.get("reveal", { type: "json" })) as RevealConfig | null) || {};
    if (mode === "open" || mode === "locked") cfg[week] = mode; else delete cfg[week];
    await config.setJSON("reveal", cfg);
    return json({ ok: true, week, override: cfg[week] || null, open: isOpen(week, cfg) });
  }

  if (action === "roster") {
    // paste of lines: matric \t name \t programme \t section \t slot   (or the raw university export with extra columns)
    const text = String(body.text || "").slice(0, 200000);
    const rows: any[] = [];
    for (const line of text.split(/\r?\n/)) {
      const f = line.split("\t").map((x) => x.trim());
      const mi = f.findIndex((x) => /^\d{9}(-\d)?$/.test(x));
      if (mi < 0) continue;
      let name = "", programme = "", section = "", slot = "";
      if (f[mi + 1] && !/^UR\d/.test(f[mi + 1]) && f.length >= 4 && !/,/.test(f[mi + 1])) {
        // compact format: matric, name, programme, section, slot
        name = f[mi + 1] || ""; programme = f[mi + 2] || ""; section = f[mi + 3] || ""; slot = f[mi + 4] || "";
      } else {
        // university export: index, name, matric, programme, status, "SECTION, DAY, TIME, ROOM", phone...
        name = f[mi - 1] || ""; programme = f[mi + 1] || "";
        const sec = f.find((x) => x.includes(",") && /AM|PM/.test(x)) || "";
        const parts = sec.split(",").map((p) => p.trim());
        section = parts[0] || ""; slot = parts.slice(1).join(", ");
      }
      if (!name) continue;
      rows.push({ matric: f[mi], key: normMatric(f[mi]), name: clean(name, 80), programme: clean(programme, 80), section: clean(section, 60), slot: clean(slot, 80) });
    }
    if (!rows.length) return json({ error: "No rows found. Paste the class list with matric numbers." }, 400);
    const merge = !!body.merge;
    let roster: any[] = merge ? (((await config.get("roster", { type: "json" })) as any[] | null) || []) : [];
    const byKey: Record<string, any> = {};
    for (const r of roster) byKey[r.key] = r;
    for (const r of rows) byKey[r.key] = r;
    roster = Object.values(byKey).sort((a: any, b: any) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
    await config.setJSON("roster", roster);
    const sections: Record<string, number> = {};
    roster.forEach((r: any) => { sections[r.section] = (sections[r.section] || 0) + 1; });
    return json({ ok: true, imported: rows.length, total: roster.length, sections });
  }

  if (action === "clear-roster") { await config.delete("roster"); return json({ ok: true }); }

  return json({ error: "Unknown action" }, 400);
};

export const config: Config = { path: "/api/admin" };
