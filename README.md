# ETC Lab · SMB31202 English for Technical Communication

Interactive weekly lessons, a live Class Wall and an AI writing coach for **SMB31202
English for Technical Communication** (UniMAP, Semester 1, Session 2026/2027).

Live site: https://smb31202-etc.netlify.app

## Open it

- Locally: serve the `public/` folder (`cd public && python3 -m http.server`) and open
  `http://localhost:8000`. No build step. The Class Wall and the AI coach need the
  Netlify Functions, so they only work on the live site.
- Deploy: the site is on Netlify (publish directory `public/`, functions in
  `netlify/functions/`). See `HANDOFF.md` for the full map and the next ideas.

## Structure

| Path | What it is |
|---|---|
| `public/index.html` | Course home: this-week status, assessments, semester timeline, week cards |
| `public/weeks/week-01.html` … `week-14.html` | One interactive lesson per week |
| `assets/css/style.css` | Shared theme |
| `assets/js/deck.js` | Slide engine + interactive widgets + saved progress |
| `assets/js/course.js` | Course data from the Scheme of Work (dates, topics, assessments) |
| `docs/AUTHORING.md` | How to edit or add a week |

Student progress, XP, ticked checklists and writing drafts are stored only in each
student's own browser (localStorage). Nothing is sent anywhere.

Keyboard: `←` `→` change slide, `C` opens the contents.
