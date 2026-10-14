import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

/* Class Wall API for ETC Lab (SMB31202).
   One blob per post, key = "<board>/<reverse-timestamp>-<rand>" so keys list newest-first.
   Likes are one tiny blob each under "likes/<board>/<postId>/<rand>", counted by listing.
   Lecturer actions (delete, pin) need the WALL_PIN env var in the x-wall-pin header. */

const BOARDS = new Set(["general"].concat(Array.from({ length: 14 }, (_, i) => "w" + String(i + 1).padStart(2, "0"))));
const COLORS = new Set(["blue", "pink", "orange", "green", "purple"]);
const MAX_POSTS = 150;
const ID_RE = /^[0-9]{13}-[a-z0-9]{4,10}$/;

type Post = { id: string; board: string; name: string; text: string; color: string; ts: number; pinned?: boolean; likes?: number };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);

const pinOk = (req: Request) => {
  const pin = Netlify.env.get("WALL_PIN");
  return Boolean(pin) && req.headers.get("x-wall-pin") === pin;
};

const boardOf = (url: URL) => {
  const b = url.searchParams.get("board") || "general";
  return BOARDS.has(b) ? b : null;
};

export default async (req: Request) => {
  const url = new URL(req.url);
  const store = getStore({ name: "class-wall", consistency: "strong" });

  if (req.method === "GET") {
    if (url.searchParams.has("auth")) return pinOk(req) ? json({ ok: true }) : json({ error: "Wrong PIN" }, 401);
    const board = boardOf(url);
    if (!board) return json({ error: "Unknown board" }, 400);
    const { blobs } = await store.list({ prefix: board + "/" });
    const keys = blobs.map((b) => b.key).sort().slice(0, MAX_POSTS);
    const posts = (await Promise.all(keys.map((k) => store.get(k, { type: "json" }).catch(() => null)))).filter(Boolean) as Post[];
    // likes
    const likes: Record<string, number> = {};
    try {
      const l = await store.list({ prefix: "likes/" + board + "/" });
      for (const b of l.blobs) {
        const id = b.key.split("/")[2];
        likes[id] = (likes[id] || 0) + 1;
      }
    } catch {}
    posts.forEach((p) => (p.likes = likes[p.id] || 0));
    posts.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.ts - a.ts);
    return json({ board, posts, count: posts.length });
  }

  if (req.method === "POST") {
    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

    // like a post: { like: true, board, id }
    if (body && body.like) {
      const board = BOARDS.has(body.board) ? body.board : null;
      const id = String(body.id || "");
      if (!board || !ID_RE.test(id)) return json({ error: "Bad request" }, 400);
      const rand = Math.random().toString(36).slice(2, 8);
      await store.set(`likes/${board}/${id}/${rand}`, "1");
      return json({ ok: true });
    }

    const board = BOARDS.has(body.board) ? body.board : null;
    if (!board) return json({ error: "Unknown board" }, 400);
    const text = clean(body.text, 600);
    if (text.length < 2) return json({ error: "Write something first." }, 400);
    const name = clean(body.name, 30) || "Anonymous";
    const color = COLORS.has(body.color) ? body.color : "blue";
    const ts = Date.now();
    const rev = String(9999999999999 - ts);
    const rand = Math.random().toString(36).slice(2, 8);
    const id = `${rev}-${rand}`;
    const post: Post = { id, board, name, text, color, ts };
    await store.setJSON(`${board}/${id}`, post);
    return json({ post }, 201);
  }

  if (req.method === "DELETE") {
    if (!pinOk(req)) return json({ error: "Lecturer PIN required" }, 401);
    const board = boardOf(url);
    const id = url.searchParams.get("id") || "";
    if (!board || !ID_RE.test(id)) return json({ error: "Bad request" }, 400);
    await store.delete(`${board}/${id}`);
    try {
      const l = await store.list({ prefix: `likes/${board}/${id}/` });
      await Promise.all(l.blobs.map((b) => store.delete(b.key)));
    } catch {}
    return json({ ok: true });
  }

  if (req.method === "PATCH") {
    // pin / unpin: ?board=&id=&pin=1|0
    if (!pinOk(req)) return json({ error: "Lecturer PIN required" }, 401);
    const board = boardOf(url);
    const id = url.searchParams.get("id") || "";
    if (!board || !ID_RE.test(id)) return json({ error: "Bad request" }, 400);
    const key = `${board}/${id}`;
    const post = (await store.get(key, { type: "json" })) as Post | null;
    if (!post) return json({ error: "Not found" }, 404);
    post.pinned = url.searchParams.get("pin") === "1";
    await store.setJSON(key, post);
    return json({ post });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = { path: "/api/wall" };
