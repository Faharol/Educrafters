import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { pinOk } from "../lib/shared.mts";

/* Live round: a lecturer-run speed quiz the class joins by code or QR.
   Blobs (store "live"):
     s/<code>              session { code, week, title, questions[], secs, state, qi, qStart, created }
     p/<code>/<pid>        player  { pid, nick, score, joined }
     a/<code>/<qi>/<pid>   answer  { k, correct, points, ms }   (written once per player per question)
   Lecturer actions need the WALL_PIN header. */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
const CODE_RE = /^[A-Z0-9]{4}$/;
const PID_RE = /^[a-z0-9]{6,16}$/;

type Q = { q: string; opts: string[]; right: number; why?: string };
type Session = { code: string; week: string; title: string; questions: Q[]; secs: number; state: "lobby" | "q" | "reveal" | "ended"; qi: number; qStart: number; created: number };

function studentView(s: Session) {
  const q = s.qi >= 0 && s.qi < s.questions.length ? s.questions[s.qi] : null;
  return { code: s.code, week: s.week, title: s.title, state: s.state, qi: s.qi, n: s.questions.length, secs: s.secs, qStart: s.qStart,
    question: q ? { q: q.q, opts: q.opts } : null,
    reveal: s.state === "reveal" && q ? { right: q.right, why: q.why || "" } : null };
}

async function players(store: any, code: string) {
  const { blobs } = await store.list({ prefix: `p/${code}/` });
  const ps = (await Promise.all(blobs.map((b: any) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean) as any[];
  ps.sort((a, b) => b.score - a.score || a.joined - b.joined);
  return ps;
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const store = getStore({ name: "live", consistency: "strong" });

  if (req.method === "GET") {
    const code = clean(url.searchParams.get("code"), 4).toUpperCase();
    if (!CODE_RE.test(code)) return json({ error: "Bad code" }, 400);
    const s = (await store.get(`s/${code}`, { type: "json" })) as Session | null;
    if (!s) return json({ error: "No such round" }, 404);
    const out: any = studentView(s);
    if (url.searchParams.has("board")) {
      const ps = await players(store, code);
      out.players = ps.slice(0, 50).map((p, i) => ({ rank: i + 1, pid: p.pid, nick: p.nick, score: p.score }));
      out.count = ps.length;
      if (s.qi >= 0) {
        const a = await store.list({ prefix: `a/${code}/${s.qi}/` });
        out.answered = a.blobs.length;
        if (url.searchParams.has("dist") && pinOk(req)) {
          const ans = (await Promise.all(a.blobs.map((b: any) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean) as any[];
          const dist = [0, 0, 0, 0, 0, 0]; ans.forEach((x) => { if (x.k >= 0 && x.k < 6) dist[x.k]++; });
          out.dist = dist.slice(0, (s.questions[s.qi] || { opts: [] }).opts.length);
        }
      }
      const pid = clean(url.searchParams.get("pid"), 16);
      if (pid) { const me = ps.findIndex((p) => p.pid === pid); out.me = me >= 0 ? { rank: me + 1, score: ps[me].score, nick: ps[me].nick } : null; }
    }
    if (url.searchParams.has("full") && pinOk(req)) out.questions = s.questions;
    return json(out);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = clean(body.action, 12);

  if (action === "create") {
    if (!pinOk(req)) return json({ error: "Lecturer PIN required" }, 401);
    const qs: Q[] = (Array.isArray(body.questions) ? body.questions : []).slice(0, 20).map((q: any) => ({
      q: clean(q.q, 400), opts: (Array.isArray(q.opts) ? q.opts : []).slice(0, 6).map((o: any) => clean(o, 200)), right: Math.max(0, Math.min(5, Number(q.right) || 0)), why: clean(q.why, 300) }))
      .filter((q: Q) => q.q && q.opts.length >= 2 && q.right < q.opts.length);
    if (qs.length < 2) return json({ error: "Need at least two questions" }, 400);
    let code = "";
    for (let i = 0; i < 8; i++) {
      code = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
      const exists = await store.get(`s/${code}`);
      if (!exists) break;
    }
    const s: Session = { code, week: clean(body.week, 2), title: clean(body.title, 80), questions: qs, secs: Math.max(10, Math.min(60, Number(body.secs) || 20)), state: "lobby", qi: -1, qStart: 0, created: Date.now() };
    await store.setJSON(`s/${code}`, s);
    return json({ code, session: studentView(s) }, 201);
  }

  const code = clean(body.code, 4).toUpperCase();
  if (!CODE_RE.test(code)) return json({ error: "Bad code" }, 400);
  const s = (await store.get(`s/${code}`, { type: "json" })) as Session | null;
  if (!s) return json({ error: "No such round. Check the code." }, 404);

  if (action === "join") {
    if (s.state === "ended") return json({ error: "That round has finished." }, 410);
    const nick = clean(body.nick, 24) || "anonymous";
    const pid = Math.random().toString(36).slice(2, 10);
    const ps = await players(store, code);
    if (ps.length >= 200) return json({ error: "Room full" }, 429);
    await store.setJSON(`p/${code}/${pid}`, { pid, nick, score: 0, joined: Date.now() });
    return json({ pid, session: studentView(s) }, 201);
  }

  if (action === "answer") {
    const pid = clean(body.pid, 16);
    if (!PID_RE.test(pid)) return json({ error: "Bad player" }, 400);
    const qi = Number(body.qi);
    if (s.state !== "q" || qi !== s.qi) return json({ error: "Too late for that question." }, 409);
    const q = s.questions[qi];
    const k = Number(body.k);
    if (!(k >= 0 && k < q.opts.length)) return json({ error: "Bad answer" }, 400);
    const ms = Math.max(0, Date.now() - s.qStart);
    if (ms > (s.secs + 3) * 1000) return json({ error: "Time is up." }, 409);
    const correct = k === q.right;
    const points = correct ? 500 + Math.round(500 * Math.max(0, 1 - ms / (s.secs * 1000))) : 0;
    const akey = `a/${code}/${qi}/${pid}`;
    const already = await store.getMetadata(akey).catch(() => null);
    if (already) return json({ error: "You already answered." }, 409);
    await store.setJSON(akey, { k, correct, points, ms });
    const p = (await store.get(`p/${code}/${pid}`, { type: "json" })) as any;
    if (p) { p.score = (p.score || 0) + points; await store.setJSON(`p/${code}/${pid}`, p); }
    return json({ correct, points, score: p ? p.score : points });
  }

  // lecturer controls
  if (!pinOk(req)) return json({ error: "Lecturer PIN required" }, 401);
  if (action === "next") {
    if (s.qi + 1 >= s.questions.length) { s.state = "ended"; }
    else { s.qi += 1; s.state = "q"; s.qStart = Date.now(); }
  } else if (action === "reveal") { if (s.state === "q") s.state = "reveal"; }
  else if (action === "end") { s.state = "ended"; }
  else if (action === "lobby") { s.state = "lobby"; s.qi = -1; s.qStart = 0; }
  else return json({ error: "Unknown action" }, 400);
  await store.setJSON(`s/${code}`, s);
  return json({ session: studentView(s) });
};

export const config: Config = { path: "/api/live" };
