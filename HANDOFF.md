# ETC Lab (SMB31202): hand-off for the next session

Repo: `Faharol/Educrafters` (GitHub, branch `main`). Live site: https://smb31202-etc.netlify.app (Netlify site `smb31202-etc`, id `2e60accb-5e86-4542-a748-e72a0f2e186d`, team `faharol`).
Owner: Dr. Faharol bin Zubir (UniMAP). Replies to the owner in casual Malay-English mix are fine.

## What it is now (15 Oct 2026, phase 2 done)

A static site plus two Netlify Functions. No build step. Deployed with `npx -y @netlify/mcp@latest --site-id … --proxy-path …` (the Netlify MCP `deploy-site` operation gives the command). GitHub Pages is no longer the target; the old `faharol.github.io/Educrafters/` links will break because files moved into `public/`.

| Path | What it is |
|---|---|
| `public/index.html` + `assets/js/hub.js` | Home, Walailak-style: black hero with photo and floating bubbles, scroll-lit statement, count-up stats, bento of 14 week tiles (photo, hook line, "This week" sticker, XP/done marks), two tickers, Class Wall promo, assessments, gallery, house rules, humour band, programme at a glance |
| `public/live.html` + `public/play.html` + `netlify/functions/live.mts` | Live round (Kahoot-style): lecturer enters PIN, picks a week, the page reads that week's quizzes, creates a 4-letter code with a QR; students join on `play.html`, answer on their phones, fastest correct scores most (500 + up to 500 by speed); reveal, per-option bars, leaderboard, podium. Blobs store `live` |
| `public/class-tools.html` | Lecturer tools: random name picker, group maker, timers with Speaking Assessment presets, projector mode. Class list stays in the browser |
| `public/course.html` | The course briefing (COs, assessments, grade scale, 14 weeks, expectations) as its own page; Week 1 now opens on the lesson and carries the briefing as an appendix |
| `public/assets/js/news.js` | "Now in the news": one real case per week (researched 15 Oct 2026, every figure checked against two sources), with verified facts, sources with dates, APA 7 reference list, two reading checks, a writing prompt with AI coach, a 10-minute class activity with timer. Injected by `deck.js` before the wall |
| Listening lab (in `lab.js`, injected by `deck.js`) | Speaker button on every model sentence (Web Speech, en-GB, 0.8x/1x), dictation with word-by-word diff and XP, record-and-compare with the microphone (local only) |
| `netlify/functions/board.mts` + home leaderboard | Opt-in XP leaderboard by nickname; devices post their XP after each award |
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

- Studio-quality recorded audio instead of browser speech.
- Refresh the news cases each semester (they are dated 15 Oct 2026); the structure in `news.js` is reusable.
- Class names in the live round and leaderboard are nicknames only by design; if marks ever depend on it, add a matric field server-side.
- Note: class names in the Lab layer are prefixed (`lph`, `ltilt`, `wd`, `lchips`, `lbig`, `wl-sw`) because the lecturers' pages already use `.ph`, `.tilt`, `.w`, `.chips`, `.big`, `.swatches`.

## Known content items for the teaching team

- Week 5: model report labelled 236 words but parts total 197. Weeks 5 and 6: closed-loop cooling install time differs (4 vs 9 months). Week 8: paper table suggests 58 min for Section A but the timing plan says 44.

## How to check your work

Serve `public/` (`python3 -m http.server`), open the home, `wall.html` and a few weeks at 1280 and 390 px, click a quiz answer (XP in the sticky nav goes up), run the boss round, and look for console errors. The wall and coach only work on the Netlify site (`/api/*`); locally they show an "offline" message.


## Phase 3 (19 Oct 2026): attendance, live monitoring, reveal schedule. BUILT AND TESTED LOCALLY, NOT DEPLOYED

The owner asked to hold the Netlify deploy until more changes are ready, then push once.

| Piece | What it does |
|---|---|
| Mission HUD (`deck.js`) | Pill at bottom-left of every week: activities done / total and % of sections read. Tap for the to-do list (each item jumps to the activity or section). Every widget registers as required: quizzes, reveals, flip grids, sorters, gap fills, write pads (min words, or 20), checklists, build-up steps, tabs, self-ratings, pickers, the week's wall post, the boss round. A section counts as read after it fills most of the screen for about 1.5 s. |
| Attendance | Unlocks only when every activity is done and every section read. Pop-up asks for the matric number (or confirms the remembered one). Not on the class list: the student types name and picks section, and the record is flagged **MANUAL · not on list** in the admin and the CSV. One record per matric per week. Server re-checks completeness and that the week is open. |
| Identity | First visit to a week asks for the matric number (can skip). Matched against the roster in Blobs (`config/roster`), not in the repo. 100 students from 4 sections were parsed from the lists the owner sent; the paste file is outside the repo at `/home/claude/roster/roster-import.tsv` (no phone numbers) and must be imported from the admin Roster tab after deploy. |
| Presence + visits | Heartbeat every 30 s from home, wall and week pages. Admin "Online now" lists everyone seen in the last 90 s, grouped by section, with page and time on. Visit log: one row per browser session per day, named once the student identifies. |
| Live writing | Every write pad syncs about 2 s after typing stops; admin "Live writing" shows the latest text per student per pad, refreshing every 5 s, with snapshots every 3 minutes (click a card for history) and CSV. |
| Reveal schedule | Week opens at 00:00 Malaysia time two days before its Monday. Edge function `netlify/edge-functions/gate.ts` redirects locked weeks to `locked.html` (countdown). Home tiles show a lock and the open date. Admin "Reveal weeks": Reveal now / Lock / Automatic per week. The lecturer passes the gate via the `etc_admin` cookie set at admin login. |
| Admin | `admin.html`, password in env var `ADMIN_PASSWORD` (the owner chose 8080@8400). Tabs: Online now, Live writing, Attendance (per section, CSV, undo), Reveal weeks, Visit log, Roster (paste import, merge or replace). The admin password also works wherever the wall PIN does. |
| New server code | `netlify/lib/shared.mts` (helpers, schedule), `netlify/functions/admin.mts`, `netlify/functions/track.mts`, `netlify/edge-functions/gate.ts`; `netlify.toml` declares the edge function. |

### Deploy checklist (one push when the owner says go)
1. Set env var `ADMIN_PASSWORD` = the owner's admin password on site `smb31202-etc` (functions + edge scopes).
2. Deploy with the Netlify MCP `deploy-site` command (fresh proxy token each time).
3. Sign in to `/admin.html`, Roster tab, paste `/home/claude/roster/roster-import.tsv` (or the raw class lists), Replace.
4. Check: Week 4+ redirect to `locked.html` for a private window; admin can open them.

### Local test rig
`/home/claude/mock/`: `build.mjs` bundles the functions with an in-memory Blobs stand-in, `server.mjs` serves `public/` plus `/api/*` and the edge gate on port 8766, `e2e.py` runs a phone student (manual identity, all activities, reading, attendance) against an admin console.

## 19 Oct 2026: attendance rule loosened, overlap fixes
- Attendance unlocks when every **core** item is done (all write pads, the week's wall post, the boss round), **70%** of the small activities (quizzes, sorters, flips, reveals, checklists, steps, tabs, rates, pickers, gap fills), and every section is read. `LIGHT_SHARE = 0.7` in both `deck.js` and `track.mts`; change both together. Week 3: 37 of 50 needed; Week 4: about 51 of 69.
- Mission panel lists core items as MUST, then "Any N more of these small activities".
- Mission pill slides away while scrolling down, returns on scroll up, near the page end, or for 2.5 s when progress ticks (it used to sit on top of buttons).
- Top bars are now opaque (text no longer shows through). Week numbers in the top bar fade at the edges and centre the current week on phones. Finale confetti fires once and only with XP > 0.

## 20 Oct 2026: progress backup by matric
- `track.mts` action `progress`: stores `prog/<matricKey>` in store `track` and merges (union of done/read/seen, max XP per activity, attendance kept). Client pushes 4 s after each save once the student has a matric (`LAB.pushProgress`), and on page load or sign-in merges the server copy into the browser (`LAB.syncProgress`), reloading once if something came back.
- The browser blob carries `owner` (matric). If a different matric signs in on that browser, the browser takes that matric's server copy (or starts empty) and never hands the previous owner's progress to the new matric. Draft text is not synced (privacy); writing stays visible in admin Live writing.
- Purpose: moving to a custom domain (e.g. smb31202.faharol.com) or switching phone/laptop keeps progress once the student types their matric. Only students who have entered a matric are backed up.
