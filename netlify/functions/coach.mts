import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";

/* AI writing coach for ETC Lab.
   Runs on Netlify AI Gateway: the Anthropic SDK picks up ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL
   that Netlify injects at runtime. Set COACH_MODEL to change the model. */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const words = (s: string) => (s.trim().match(/\S+/g) || []).length;

const SYSTEM = `You are the writing coach inside "ETC Lab", the course website for SMB31202 English for Technical Communication at Universiti Malaysia Perlis (UniMAP). The writers are engineering undergraduates (CEFR B2, aged 19 to 22). Their assessed writing is a short report for a manager written from a chart or table (220 to 260 words, 45 minutes), marked on four criteria out of 5 each: content and task fulfilment; organisation and coherence; use and interpretation of visual data; language accuracy and register.

Your job is to coach, never to write for them. Rules:
- Never rewrite the whole text. Quote at most short phrases (under 12 words) when you show a fix.
- Be warm, direct and specific. Short sentences. No em dashes.
- Plain text only. Use these exact headings on their own lines: "Overall", "What works", "Fix these", "Score", "Next step".
- "What works": 2 or 3 bullet points starting with "- ".
- "Fix these": 3 bullet points max. Each names the problem, quotes the phrase, and gives a short better version. Prioritise errors that cost marks: register, verb tense, subject-verb agreement, articles, data language (rose to, increased by, accounted for), paragraphing, missing recommendation.
- "Score": only if the task is a report or a test-style piece: give the four criteria as "Content x/5 · Organisation x/5 · Visual data x/5 · Language x/5 · Total x/20". For other tasks write one line on whether the target was met.
- "Next step": one sentence, one concrete thing to do now.
- Keep the whole reply under 220 words.
- If the text is off-task, copied, or written by an AI, say so kindly and ask for their own attempt.`;

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!Netlify.env.get("ANTHROPIC_BASE_URL") && !Netlify.env.get("ANTHROPIC_API_KEY"))
    return json({ error: "The AI coach is not switched on yet (AI Gateway needs one production deploy)." }, 503);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const text = String(body.text || "").slice(0, 4000).trim();
  if (words(text) < 15) return json({ error: "Write at least 15 words first, then ask for feedback." }, 400);
  const task = String(body.task || "").slice(0, 600);
  const week = String(body.week || "").slice(0, 4);
  const title = String(body.title || "").slice(0, 120);
  const min = Number(body.min || 0), max = Number(body.max || 0);

  const user = [
    `Week ${week}: ${title}`,
    task ? `Task: ${task}` : "",
    min || max ? `Target length: ${min || "?"}${max ? " to " + max : "+"} words. Actual: ${words(text)} words.` : `Actual length: ${words(text)} words.`,
    "",
    "Student text:",
    '"""',
    text,
    '"""',
  ].filter((x) => x !== "").join("\n");

  try {
    const client = new Anthropic();
    const model = Netlify.env.get("COACH_MODEL") || "claude-haiku-5-5";
    const msg = await client.messages.create({
      model,
      max_tokens: 900,
      thinking: { type: "disabled" } as any,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const out = (msg.content || []).map((c: any) => (c.type === "text" ? c.text : "")).join("").trim();
    if (!out) return json({ error: "The coach gave an empty reply. Try again.", detail: JSON.stringify({ stop: msg.stop_reason, types: (msg.content || []).map((c: any) => c.type), usage: msg.usage }).slice(0, 400) }, 502);
    return json({ feedback: out, model: msg.model, words: words(text) });
  } catch (e: any) {
    return json({ error: "The coach could not answer right now. Try again in a minute." , detail: String(e?.message || e).slice(0, 200) }, 502);
  }
};

export const config: Config = { path: "/api/coach" };
