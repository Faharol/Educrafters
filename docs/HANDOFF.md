# SMB31202 site: hand-off for the next session

Repo: `Faharol/Educrafters` (GitHub). Live site: https://faharol.github.io/Educrafters/
Owner: Dr. Faharol bin Zubir (course coordinator, UniMAP). Replies to the owner in casual Malay-English mix are fine.

## What exists (all working, merged into `main`)

A static website, no build step. Open `index.html` in a browser to run it.

| Path | What it is |
|---|---|
| `index.html` | Home: hero, this-week tile, marks donut + cumulative-marks chart, 14-week timeline, photo cards |
| `weeks/week-01.html` … `week-14.html` | One long scrolling "newsletter issue" per teaching week. Weeks 8, 10, 13, 14 are assessment weeks (briefing only, no test papers) |
| `assets/css/style.css` | Whole design system. Light, Apple-inspired. Variables at the top |
| `assets/js/deck.js` | Lesson engine: wires every widget, XP, progress, contents drawer, cover/chapter photos, next-issue card |
| `assets/js/motion.js` | Parallax, word-by-word reading reveal, tilt cards, particle burst. Off for `?static` and reduced-motion |
| `assets/js/course.js` | Course data (dates, topics, assessments) taken from the Scheme of Work |
| `assets/js/hub.js` | Home-page rendering |
| `assets/img/*.jpg` | ~31 photos taken from the original course slides (Unsplash licence) |
| `docs/AUTHORING.md` | Widget markup reference (quiz, sorter, gap-fill, flip cards, write pad, timer, tabs, checklist, steps …) |

Source of the lessons: the teaching team's weekly slide decks (Google Drive folder `3.WEEKLY SLIDES`, shared with faharol@gmail.com). Course facts come from `SMB31202_Scheme_of_Work_Sem1_20262027`.

## Things already decided

- Content comes from the lecturers' slides. Do not delete their content; add to it.
- Never invent statistics. Anything illustrative must be labelled "illustrative" on the page.
- No test questions or answer schemes are published.
- Progress, XP, ticks and writing drafts live in the student's own browser (`localStorage`, key `smb31202.progress.v1`). There is no server.
- Everything must work on a phone (390 px) with no sideways scroll, and must show all content when the user has "reduce motion" on.

## What the owner wants next

1. **Deploy on Netlify** (instead of / as well as GitHub Pages). Plan: in Netlify, *Add new site → Import from Git → Faharol/Educrafters*, branch `main`, no build command, publish directory `.`. After that every push to `main` deploys by itself. An empty Netlify site `smb31202-etc` already exists on the owner's team.
2. **Students can write.** Write pads already exist and autosave. Add: a "My Writing" page listing every draft across weeks (word count, copy, download `.txt`, print), and a "Send to lecturer" button using **Netlify Forms** (name, matric number, class, week, activity, text). Forms only work on Netlify, so hide the button elsewhere. Add a short self-check list on each pad.
3. **Audio students can listen to.** Default approach is the browser's built-in speech (Web Speech API, free): a speaker button on every model sentence, pull quote, reading passage and dialogue; speed control (0.8× / 1×); two-voice dialogue player for the speaking weeks; "listen and type" dictation activity; "record yourself and compare" (microphone, played back locally, nothing uploaded). Optional upgrade later: studio-quality recorded files.
4. **More engaging class activities.** Add new widgets (speed-round quiz with streak and lives, drag-to-order sentences, spot-the-error in a passage, match pairs, role-play cards with a timer) and give each week one 10–15 minute pair/group "Class activity" section. Also a `class-tools.html` page for lecturers (random name picker, group maker, timers).
5. **Images that feel current and "hip, but still professional".** The photos now are older stock photos from the slides. Replace with modern ones (young engineers, labs, coworking, laptops, AI tools, clean-energy sites) or modern vector illustrations. Keep file sizes small (≤ 250 KB each, 1200 px wide) and add alt text.
6. **Current issues and current examples.** For every week add a "Now in the news" case about a real, recent engineering or workplace issue (for example AI in engineering work, data-centre energy and water, EV batteries, solar and the energy transition, semiconductors, e-waste, heat and flood resilience, cybersecurity, Malaysia-specific stories alongside global ones). Verify every figure against at least two sources, show the source and date on the page, and cite it in APA 7 (it doubles as a referencing example). Use each case for a reading task, a writing prompt and a class activity. Replace dated examples where the lesson allows it, and keep the lecturers' fictional teaching examples (NorthStar Components, GreenTech) clearly marked as teaching examples.

## Known items in the lessons for the teaching team to check

- Week 1: the "Individual 60% · Group 40%" heading was changed from "80/20" to match the marks table.
- Week 5: the model report is labelled 236 words but its parts total 197.
- Weeks 5 and 6: closed-loop cooling install time is 4 months in one and 9 months in the other.
- Week 8: the paper table suggests 58 min for Section A but the timing plan says 44.
- Week 1 images (slides 17 and 29) could not be read; those slides were rebuilt from text and a past answer key. Weeks 3 and 11 had a few diagram slides rebuilt from text.

## How to check your work

Open each page at desktop and 390 px width, scroll the whole page, click one quiz answer (XP in the top bar should go up), and look for console errors. Add `?static` to a URL to turn animation off.
