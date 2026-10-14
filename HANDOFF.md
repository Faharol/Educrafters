# ETC Lab (SMB31202): hand-off for the next session

Repo: `Faharol/Educrafters` (GitHub, branch `main`). Live site: https://smb31202-etc.netlify.app (Netlify site `smb31202-etc`, id `2e60accb-5e86-4542-a748-e72a0f2e186d`, team `faharol`).
Owner: Dr. Faharol bin Zubir (UniMAP). Replies to the owner in casual Malay-English mix are fine.

## What it is now (15 Oct 2026)

A static site plus two Netlify Functions. No build step. Deployed with `npx -y @netlify/mcp@latest --site-id … --proxy-path …` (the Netlify MCP `deploy-site` operation gives the command). GitHub Pages is no longer the target; the old `faharol.github.io/Educrafters/` links will break because files moved into `public/`.

| Path | What it is |
|---|---|
| `public/index.html` + `assets/js/hub.js` | Home, Walailak-style: black hero with photo and floating bubbles, scroll-lit statement, count-up stats, bento of 14 week tiles (photo, hook line, "This week" sticker, XP/done marks), two tickers, Class Wall promo, assessments, gallery, house rules, humour band, programme at a glance |
| `public/wall.html` | Class Wall page: boards (General + one per week), composer with colour swatches and nickname, likes, lecturer mode (PIN) with pin-to-top and delete, projector mode |
| `public/weeks/week-01…14.html` | The lecturers' lessons (unchanged content). `deck.js` wraps each in the new chrome |
| `public/assets/js/deck.js` | Lesson engine. Builds: global nav, photo hero (Ken Burns, parallax, word-in title), sticky lesson nav with the mission rail (Hook · Learn · Try · Wall · Boss), the Hook band, the week's Class Wall, the Boss round (speed quiz auto-built from the page's `.quiz` widgets: 10 Qs, 3 lives, 90 s, XP by score), AI coach on write pads with min/max ≥ 30 words, finale, next issue |
| `public/assets/js/lab.js` | Shared runtime: nav, motion (rise-in, word-in, scrub, parallax, tilt/sheen, count-up), toast, confetti, Wall client, coach client, boss round |
| `public/assets/js/hooks.js` | Per-week copy: hook headline, scenario, why-it-matters, question, wall prompt, boss blurb; plus ticker phrases |
| `public/assets/js/course.js` | Course data from the Scheme of Work (unchanged) |
| `public/assets/css/lab.css` | Theme layer loaded after `style.css`: dark chrome, bands, orbs, tickers, tiles, wall posts, boss round, coach, phone rules, calm mode |
| `public/assets/img/` | New Pexels photos `hero.jpg`, `wk01…wk14.jpg`, `g-*.jpg` (≤ 250 KB, 1200 px) with `CREDITS.md`; old slide photos kept for in-lesson figures |
| `netlify/functions/wall.mts` | `/api/wall`: GET posts (+likes), POST post or like, DELETE post (PIN), PATCH pin/unpin (PIN). Netlify Blobs store `class-wall`, strong consistency, 150 posts per board |
| `netlify/functions/coach.mts` | `/api/coach`: Anthropic SDK through Netlify AI Gateway (no API key in repo). Model `claude-haiku-5-5` (override with env `COACH_MODEL`); thinking disabled; feedback only, never rewrites |
| `docs/AUTHORING.md` | Widget markup reference, still valid |

Secrets: `WALL_PIN` is a Netlify environment variable on the site (not in the repo). The owner has the PIN. Lecturer mode is unlocked on the wall with that PIN and remembered per tab.

## Decisions kept

- Lecturers' slide content stays; the Lab layer wraps it. Never invent statistics. No test papers or answer schemes published.
- No identity: students post with auto-generated nicknames (editable). No matric numbers on the wall.
- Progress, XP, drafts, likes: `localStorage` on the student's device (`smb31202.progress.v1` and `etclab:*`).
- Everything works at 390 px with no sideways scroll. `?static` and "reduce motion" switch animation off; a "Motion: on/off" toggle in footers sets calm mode.
- Billing: the coach runs on Netlify AI Gateway credits on the owner's Netlify account (Haiku 5.5, about 1 credit per 1,000 feedbacks at current rates). The owner wants to keep key handling minimal.

## Ideas not done yet

- Live mode in class: lecturer starts a speed round, students join with a QR code, live leaderboard.
- Audio: Web Speech buttons on model sentences, dictation, record-and-compare.
- "Now in the news" case per week with verified sources (APA 7), and the `class-tools.html` page (name picker, group maker, timers).
- Per-class leaderboard (opt-in nicknames) so XP has a social meaning.
- Course page for the briefing material (COs, grade table) so Week 1 can open on the lesson.

## Known content items for the teaching team

- Week 5: model report labelled 236 words but parts total 197. Weeks 5 and 6: closed-loop cooling install time differs (4 vs 9 months). Week 8: paper table suggests 58 min for Section A but the timing plan says 44.

## How to check your work

Serve `public/` (`python3 -m http.server`), open the home, `wall.html` and a few weeks at 1280 and 390 px, click a quiz answer (XP in the sticky nav goes up), run the boss round, and look for console errors. The wall and coach only work on the Netlify site (`/api/*`); locally they show an "offline" message.
