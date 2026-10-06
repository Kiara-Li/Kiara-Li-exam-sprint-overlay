# Modern Art History Study UI

A static, coursework-only mobile interface reconstructed from the supplied Quizlet screen recording and still screenshots. The content is replaced with a Modern Art History survey containing four chapters and 15 accurate term-definition pairs per chapter.

Chapter 1 is intentionally an extra-easy testing set with direct artist, artwork, and movement associations. Chapters 2–4 retain their more detailed survey-course content.

The project now has two layers. The **base** layer is the Quizlet reproduction. The **overlay** layer adds *Exam Sprint*, the time-planning concept for Project 2, "Garden of Forking Paths".

## Modes

| URL | What renders |
|---|---|
| `?mode=original` | The base reproduction only, unchanged |
| `?mode=sprint` | Base + Exam Sprint overlay (**default**) |
| `?debug=1` | Opens the full debug panel (also: triple-tap the top strip, or the `Debug` button) |

A slim black **prototype bar** is pinned to the top of every screen. It switches
between Original and Sprint at any point without a reload, names the state the
prototype is currently in, and opens the debug panel or resets the session.

## File tree

```text
modern-art-quizlet-ui/
├── .openai/
│   └── hosting.json
├── README.md
└── dist/
    ├── index.html
    ├── base/
    │   ├── app.js              routing, flashcard / Learn / Test engines
    │   ├── data.js
    │   ├── quiz.js             deterministic question generation
    │   ├── extensions.js       hook registry for layers above the base
    │   ├── overlay-loader.js   reserved integration point
    │   ├── tokens.css
    │   ├── assets/icons/       24 screenshot-derived UI icons
    │   ├── components/
    │   └── screens/
    └── overlay/
        ├── index.js            sprint controller: state, flow, events
        ├── overlay.css         imports every overlay stylesheet
        ├── tokens.overlay.css  semantic aliases of base tokens only
        ├── state/
        │   ├── clock.js        sprint clock, debug time control
        │   └── sprintPlan.js   plan model, allocation, reallocation
        ├── components/
        │   ├── Island.*        the floating timer, all five states
        │   ├── DateTimePicker.* calendar + clock, authored in English
        │   ├── PlanDonut.*     the plan as a ring, hover or tap a wedge
        │   ├── Spotlight.*     dims the folder page around "Study all"
        │   ├── PlanTimeline.*  segmented time bar, used inside the island
        │   ├── ParkedSheet.*   sheet shell, parked list, adjust-times
        │   ├── SprintAlert.*   ahead / mild / severe alert builders
        │   └── glyphs.js       clock, save and check glyphs
        ├── screens/
        │   ├── StudyChooser.*  Study all vs Prep for an exam
        │   ├── ExamSetup.*     exam time, chapters, shaky chips
        │   ├── PlanReady.*     the generated plan, loading, error
        │   ├── ChapterDone.*
        │   └── SprintDone.*
        └── debug/
            ├── ModeBar.*       the always-visible prototype bar
            └── DebugPanel.*
```

All design values are defined as CSS custom properties in `base/tokens.css`. `overlay/tokens.overlay.css` adds semantic aliases only — every overlay value resolves to a base token, or is derived from one with `color-mix`.

## How the overlay attaches to the base

No file in `/base` was changed to make the overlay work. The overlay reaches the base through two small, default-inert extension points:

- `base/extensions.js` — a hook registry (`interceptClick`, `afterRender`, `learnExtras`, `onLearnAnswer`, `onLearnComplete`, `onFlashComplete`, `onTestAnswer`, `onTestComplete`). With nothing registered the base behaves exactly as before.
- `window.__base` — the base's own API (`startFlashcards`, `startLearn`, `startTest`, `removeLearnQuestion`, `appendLearnQuestions`, `buildQuestions`, `reset`), used by the overlay to drive study sessions over a subset of terms.

The overlay renders into its own `#ov-root` layer stack above `#app`, so base markup is never rewritten.

## Implemented screens and states

### Base

- Folder page with four chronological study sets
- Study set overview
- Flashcard front, flipped, familiarity-rating, swipe, review-queue, and completion states
- **Learn: a full multi-question round over every term in the set**, with correct and wrong feedback; missed terms are re-asked once. One question per set is deliberately hard: its three distractors are hand-picked near-neighbours
- Test setup screen
- **Test: a full multi-question round**, advancing on selection

Match is not implemented, so its row was removed from the set overview rather than left as a dead end.

The create-folder sheet, content-source menu, and camera capture screens shown in the first four supplemental screenshots are intentionally excluded because they are outside the original six-screen scope.

### Overlay (sprint mode)

- Folder page spotlight: everything but `Study all` is dimmed, so the first tap lands on the sprint entry point
- Study chooser sheet, exam setup (date + time picker, quick picks, bottom action), plan building, plan ready, adjust times
- Plan shown as a ring: one wedge per set, hover or tap a wedge to read its budget
- Chapter loop: Flashcards (20% of the budget) → Learn (80%), island visible throughout
- Island: compact, expanded, alert, celebrate, catch. It spans the same width as the content below it and is present on **every** study screen — Flashcards, Learn, Test, the setup and completion screens — counting down in minutes **and seconds**. Reached a study screen without a plan? It says `No time plan` and offers `Plan my time`
- Swipe-to-save is a single gesture shared by the card and the island: as the card rises and shrinks, the island reaches down with a neck and a `Release to save` tag, then squashes as it swallows the card
- Parking from **both Flashcards and Learn**, by swipe-up or by the `Save for later` button, with the parked sheet and `Work on these now · 5 min`. Anything parked during Flashcards is skipped in that chapter's Learn round
- The save prompt escalates: a quiet pill before answering, a solid blue one right after a miss, `Review this card` once a term has been missed twice, and an island alert — `"<term>" is costing you time.` — the second time the same term is missed
- Exam time is picked with an in-page calendar and clock, so no string on screen comes from the browser's locale
- Chapter done: the reallocation is the headline, and the minutes fly from it into the `Up next` card, whose number then ticks up
- Final review built from missed + parked terms, then sprint done
- Alerts: ahead (auto-collapse), mild (island, choice of donor), severe (bottom sheet)
- Empty folder, no sets selected, exam time in the past, too-little-time, and plan-failed states
- Session log export as JSON (screen dwell times, parks by swipe vs button, alert choices, every reallocation)

In sprint mode each chapter uses the **first 8 terms** of its set so a session fits a 10–15 minute user test. The plan still shows realistic times; the debug panel fast-forwards the clock.

## Run locally

```sh
python3 -m http.server 4178 --directory dist
```

Then open `http://127.0.0.1:4178`.

## Icon treatment

Core interface icons are cropped directly from the user-supplied screenshots and used as local PNG assets. Every crop arrived fully opaque on the screenshot's white field, so each one has had its background knocked out: a flood fill from the border removes only background that is connected to the edge, which leaves whites that belong to the artwork intact, and the anti-aliased rim keeps a partial alpha with the background lifted back out so no milky halo remains. `wrong.png` additionally had a grey wedge of the neighbouring card baked into the crop; since the cross is the only chromatic thing in that frame, its coverage was rebuilt from chroma, which drops the grey to zero. Their surrounding HTML buttons remain interactive and accessible. The recording-time pill and the phone signal, Wi-Fi, and battery bar are intentionally removed.

Flashcards can be rated with Repeat, Hard, Okay, or Easy. Repeat and Hard cards are returned to the study queue. Horizontal swipes use the same system: short/long left swipes map to Hard/Repeat, while short/long right swipes map to Okay/Easy.

## Values that remain approximate

- Quizlet’s proprietary typeface was not available. The token stack starts with `Hurme Geometric Sans 2` and falls back to Avenir Next, Century Gothic, and Arial.
- Exact internal production measurements and animation timing were inferred from the screenshots.
- The source is a native iPhone app; this deliverable is a static mobile-web reconstruction sized to a 464-pixel visual canvas.
- See `OVERLAY-NOTES.md` for everything the overlay had to guess, and why.
