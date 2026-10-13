# Authoring a week

Each week is one self-contained HTML file in `weeks/week-NN.html`. The shared engine
(`assets/js/deck.js`) and theme (`assets/css/style.css`) do the rest. No build step.

`weeks/week-12.html` is the reference: copy its `<head>`, `<body>` attributes and
closing `<script>` exactly, then replace the slides.

## Page skeleton

```html
<body data-week="03" data-title="Research Skills & Paraphrasing">
<main class="deck">
  <section class="slide slide--title" data-title="Welcome">…</section>
  <section class="slide" data-title="Short contents label">…</section>
  …
  <section class="slide" data-title="Session complete"> <div class="finale">…</div> </section>
</main>
<script src="../assets/js/deck.js"></script>
</body>
```

- `data-week` is two digits. `data-title` on each slide is its line in the Contents drawer.
- Part dividers: `<section class="slide slide--part" data-title="Part A · …"><div class="part-letter">A</div><h2>…</h2><p class="slide__lead">…</p></section>`
- Keep a slide to roughly one screen. Split long slides rather than cramming.
- The last slide must be the finale (copy from week 12; it fills in XP and fires confetti).

## Building blocks (pure CSS)

`card`, `card--accent`, `grid grid-2|3|4`, `tag` (+ `tag--violet|pink|amber|red|lime`),
`num-badge`, `callout` (+ `--warn|--bad|--ok`), `example` (a quoted model sentence),
`table-wrap` > `table` (use `<caption>`, `td.num` for numbers), `slide__kicker`, `slide__lead`,
`grad-text`, `muted`, `small`, `mt`.

## Interactive widgets (auto-wired, award XP once)

| Widget | Markup |
|---|---|
| Multiple choice | `<div class="quiz" data-xp="10" data-label="Quick check"><p class="quiz__q">Q?</p><div class="quiz__opts"><button data-why="feedback">A</button><button data-correct data-why="why it is right">B</button></div></div>` |
| Reveal answer | `<details class="reveal" data-xp="5"><summary>Check your answer</summary><div class="reveal__body">…</div></details>` |
| Flip cards | `<div class="flip-grid" data-xp="10"><div class="flip"><div class="flip__front"><h4>Term</h4></div><div class="flip__back"><p>Meaning</p></div></div>…</div>` |
| Sort into boxes | `<div class="sorter" data-xp="15" data-label="…"><div class="sorter__pool"><button class="chip" data-bin="x">item</button>…</div><div class="sorter__bins"><div class="bin" data-bin="x"><span class="bin__label">X</span></div>…</div></div>` (`data-bin="a\|b"` = either box is right) |
| Gap fill | `<div class="gapfill" data-xp="15"><p>Sales <input class="gap" data-answer="rose\|increased"> sharply.</p></div>` |
| Writing pad | `<div class="write" data-min="60" data-max="80" data-xp="20" data-label="…"><p class="small muted">Instructions</p><textarea placeholder="…"></textarea></div>` (draft auto-saved) |
| Checklist | `<ul class="checklist" data-xp="10"><li>…</li></ul>` (ticks saved) |
| Build-up steps | `<ol class="steps" data-build><li><div><h3>…</h3><p>…</p></div></li>…</ol>` (omit `data-build` to show all) |
| Tabs | `<div class="tabs"><div class="tabs__bar"><button data-tab="a">A</button>…</div><div class="tabs__panel" data-panel="a">…</div>…</div>` |
| Timer | `<div class="timer" data-xp="15" data-label="…" data-phases='[{"label":"Prep","sec":120,"hint":"…"}]'></div>` |
| Self-rating | `<div class="rate" data-min="1" data-max="10">Question text</div>` |
| Random picker | `<div class="picker" data-label="…" data-items='["a","b"]'></div>` |
| Animated bars | `<div class="hbars"><div class="hbar"><span>Label</span><div class="hbar__track"><div class="hbar__fill" data-v="46" data-max="50">46</div></div></div></div>` |

Week-specific behaviour can go in an inline `<script>` placed **after** `deck.js`;
use `window.Deck.award(Deck.widgetId("x"), 10)` to give XP.

## Content rules

- Every fact, number, example and model answer comes from the original slide deck.
  Do not invent data. If a slide was only an image, rebuild it from what the deck text
  says, or as an inline SVG/CSS visual that shows the same idea.
- Turn passive slides into something to do: a check question after each concept,
  a sort or gap-fill for vocabulary, a writing pad for every writing task, and a
  "check your answer" reveal straight after it (the decks are built for self-study).
- Plain, friendly English for B2 students. Short sentences.
- No external images or scripts; only Google Fonts. Everything must work offline-ish.
