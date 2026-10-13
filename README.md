# Educrafters · SMB31202 English for Technical Communication

Interactive, futuristic web lessons for **SMB31202 English for Technical Communication**
(UniMAP, Semester 1, Session 2026/2027). Every weekly slide deck is rebuilt as an
interactive lesson with quizzes, sorting games, gap-fills, flip cards, writing pads with
model answers, exam timers, checklists and XP progress tracking.

## Open it

- Locally: open `index.html` in any browser. No install or build step.
- Online (free): GitHub repo → **Settings → Pages** → Source: *Deploy from a branch* →
  Branch: `main`, folder `/ (root)` → Save. The site appears at
  `https://faharol.github.io/Educrafters/` after a minute.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Course home: this-week status, assessments, semester timeline, week cards |
| `weeks/week-01.html` … `week-14.html` | One interactive lesson per week |
| `assets/css/style.css` | Shared theme |
| `assets/js/deck.js` | Slide engine + interactive widgets + saved progress |
| `assets/js/course.js` | Course data from the Scheme of Work (dates, topics, assessments) |
| `docs/AUTHORING.md` | How to edit or add a week |

Student progress, XP, ticked checklists and writing drafts are stored only in each
student's own browser (localStorage). Nothing is sent anywhere.

Keyboard: `←` `→` change slide, `C` opens the contents.
