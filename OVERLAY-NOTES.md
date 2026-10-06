# Exam Sprint overlay — what was guessed or approximated

Checked against the build spec. Everything below is a place where the spec
assumed something the base reproduction does not contain, or where a detail had
to be decided without a reference from the real app.

## Reuse targets the base layer does not have

The reuse map in the spec points at several base patterns that were explicitly
left out of the original six-screen scope. These were rebuilt from base tokens
in the same style, and should be checked against the real app:

| Spec says reuse | Reality | What was built |
|---|---|---|
| Bottom sheet from the Create menu | No sheet exists in the base | Sheet shell in `components/ParkedSheet.css`: grabber, `--radius-2xl` top corners, spring slide-up, scrim derived from `--color-text` |
| Create-folder modal header and grouped card | Not in the base | `Cancel` / `Make my plan` text buttons in an `.app-header` grid, grouped card on `--color-surface-soft` |
| Tag chips from the folder page | The base has `.folder-tabs` spans, not buttons | `.ov-chip`, copied from `.folder-tabs` styling; selected state matches `.folder-tabs .is-active` |
| Confetti from the Learn completion screen | The base completion screen has a trophy, no confetti | A small CSS confetti built from the four chapter colors. The spec says not to build a new one — there was none to reuse |
| Learn feedback tone | Present and reused as-is (`--color-warning-dark` for warnings, `--color-success-dark` for success) | — |

## Icons

The base icon set has no clock, no upward arrow and no standalone checkmark that
reads on a filled background. Three inline SVGs were added in
`components/glyphs.js`, drawn two-tone in the style of the base mode icons and
colored from `--color-primary` / `--color-cyan`. Replace them if the real app
has these glyphs.

## Island placement

The spec says the island sits "below the status bar". This reproduction removes
the status bar, so the island sits at `--space-3` from the top of the canvas,
and base screens gain a `padding-top` of the island's compact height while it is
visible. The island does not cover the Learn close button or progress bar when
compact. When **expanded** it does overlap the header area — this was treated as
acceptable for a transient, user-initiated state, the way a real Dynamic Island
behaves. Worth confirming.

## Numbers that had to be chosen

- **Compact island width** is a fixed `--island-width-compact` rather than
  content width, because width cannot animate from `auto`. The height morph uses
  an animatable `grid-template-rows: auto 0fr → 1fr`.
- **Swipe-up to park** fires at 80 px of upward travel with the vertical
  component dominant. The base's horizontal flashcard swipe uses 56 / 140 px;
  there was no vertical reference.
- **Pull-down on the island** opens the parked sheet at 24 px.
- **Mild vs severe**: mild is an overrun of 10 min or less (from the spec).
  Severe fires when the projected overrun exceeds the final review's spare
  minutes by more than that 10 min margin *and* a whole chapter still remains.
  The spec says "a whole chapter cannot fit" without defining the test.
- **Chapter colors**: the spec maps timeline stage colors to the Flashcards,
  Learn and Test mode icons, which gives only three. Four chapters needed four
  identities, so chapters use primary / cyan / success / warning and the final
  review uses `--color-primary-dark`. The flashcards sub-band inside each
  chapter segment is the chapter color lightened with white.

## Base changes that were needed anyway

These are changes to `/base`, made because the base layer was incomplete, not to
make the overlay work. Both keep the existing visuals exactly:

- **Learn was a single hard-coded question.** It is now a real round over every
  term in the set (`base/quiz.js` generates definition → term multiple choice,
  deterministically). Missed terms are re-asked once at the end.
- **Test was a single hard-coded question** that only highlighted a selection. It
  is now a real round that advances on selection. The final review depends on
  this.

`base/extensions.js` and the `window.__base` API were added as the extension
points; with no hooks registered the base is byte-for-byte unchanged in
behavior, which `?mode=original` exercises.

## Behavior decided without a reference

- **Leaving a study screen by its close button ends the sprint** (island hides,
  plan is kept, base returns to the set overview) rather than leaving the island
  floating over a screen it no longer tracks. The spec does not cover this exit.
- **Final review when nothing was missed or parked**: falls back to the first two
  terms of each chapter so the screen is never empty.
- **Adjust times** pulls from and returns to Final review, per the spec, and
  never lets a chapter drop below 1 minute.
- **"1 more min"** on the flashcards hand-off extends the flashcards stage only;
  it does not change the chapter budget.

## Out of scope, as specified

Real iOS Live Activity, syllabus upload, in-sprint scanning, accounts and
persistence across reloads are not implemented.

---

# Round 2 — changes from the first review

## Deliberate departures from the build spec

These override the spec because the prototype needed them more than it needed
the written rule. Flagging them so the report can say so.

- **The countdown always shows seconds.** Spec §6.1 said minutes above five
  minutes, `m:ss` below, with the change of granularity carrying the urgency.
  A ticking second hand makes time passing legible from the first glance, so the
  island now reads `m:ss`, or `h:mm:ss` over an hour, the whole way through.
- **The plan is a ring, not a bar.** Spec §6.2 specified a horizontal segmented
  timeline on PlanReady. A full-width bar did not read as "how my evening is
  divided". It is now a donut: one wedge per set, numbered on the ring, with a
  hover or tap revealing that set's budget below, and a legend underneath.
  The segmented bar survives inside the expanded island, where it is small and
  a playhead is what matters.
- **Exam time is a real date and time picker.** Spec §5.2 led with quick chips
  (`In 1 hr`, `In 2 hr`, …). People know their exam as a date and a time, and
  one or two hours is not a window in which four sets get studied. The screen
  now leads with date + time fields and keeps three shortcuts: `In 6 hours`,
  `Tonight`, `Tomorrow 9 AM`.
- **`Make my plan` is a bottom action**, not a header button, matching the
  weight of the decision.
- **Shaky copy.** "Tap any that feel shaky (optional)" became the heading
  "Any you don't feel ready for?" with the line "Tap them and we'll give those
  sets more time." The word "optional" is gone.

## New in this round

- **Prototype bar.** A slim black strip pinned above everything, with
  Original / Sprint pills, the current state, Reset and Debug. Mode switching
  had to be one tap during a session rather than a hidden triple-tap. It is
  dev chrome and sits outside the Quizlet visual language on purpose.
- **Folder-page spotlight.** Everything but `Study all` is dimmed, with the
  real button lifted above the scrim and a "Start here" hint, so a participant's
  first tap does not disappear into a single chapter. Tapping anywhere on the
  scrim opens the chooser. It appears once per session.
- **One genuinely hard question per set.** `data.js` now carries a `hard` entry
  naming a term and three hand-picked near-identical distractors — for Chapter 1,
  "Impression, Sunrise" against "Impressionism", "Claude Monet" and
  "The Starry Night". Everyone stalls there, which is the point: parking needs a
  moment that earns it. Logged as `hard: true` on every `learn-answer` event.
- **The save prompt escalates.** A quiet pill before answering; a solid blue
  "Save it for later" the moment a question is missed; `Review this card`
  alongside it from the second miss. The coach mark is now a solid card with a
  pointer, and reads "Don't know one? Swipe the question up to save it for
  later." — no more "Stuck?", and no more text on a transparent background.
- **The swipe actually works.** It now takes pointer capture on the question
  card, so the gesture survives the pointer leaving the card; the threshold is
  60 px; the card rubber-bands and fades past the threshold; and the click that
  follows a swipe is swallowed so a swipe never answers the question.
- **Reallocation animation.** On ChapterDone the saved or overspent minutes are
  the headline card, and a pill carries them across the screen into the
  `Up next` card, which then ticks its number up. Falls back to a plain number
  change under `prefers-reduced-motion`.
- **Match removed** from the set overview, since it was never implemented.
- **The island counts the final review**, not the last chapter, once the sprint
  reaches the Test stage.

## Still approximate

- `<input type="date">` and `<input type="time">` render in the **browser's
  locale**, not the page's. On a machine set to Chinese the time field reads
  `上午09:00`. The underlying value and every string the overlay writes are
  English. Changing this means dropping the native pickers, which would cost
  more than it buys.
- The exam-time **"reset the clock" control** the review mentioned is not built.
  The debug panel's time controls cover it for testing.

---

# Round 3 — changes from the second review

## Bug fixed

**Learn answers could not be clicked.** The swipe-to-park gesture called
`setPointerCapture` on `pointerdown`. Once an element has pointer capture the
browser retargets the following `click` to that element, so every tap on an
answer was delivered to the question container instead of the button. Capture
now happens lazily, on the first `pointermove` that is clearly a vertical drag,
so a plain tap never captures anything.

## New in this round

- **Swipe-to-save is one continuous gesture.** Dragging the card publishes a
  0→1 progress value that drives both ends at once: the card shrinks and rises
  while the island lifts and tightens, and past the threshold the island rings
  itself in green. On release the card flies in and the island plays a
  squash-and-stretch, so it visibly *takes* the question rather than the
  question just leaving.
  A first version grew a neck out of the island's underside with a
  `Release to save` tag; both were cut. The neck read as a stray blob against
  the header, and the tag could be left behind if the pointer was released
  somewhere the card never saw. The catch state is now cleared on any
  `pointerup`, `pointercancel` or window blur, so it cannot stick.
- **Flashcards can be parked too**, by the same swipe. A term parked during
  Flashcards is removed from that chapter's Learn round and waits in the saved
  list. If every card gets parked, the chapter goes straight to the
  "tackle them now?" decision instead of starting an empty round.
- **The island is on every study screen**, with or without a plan. Reaching
  Learn straight from the set overview used to leave the screen bare, which made
  the feature look like it only existed in Flashcards. With no plan it reads
  `No time plan` and offers `Plan my time`.
- **The island spans the content width.** Compact and expanded are now the same
  width, so only the height morphs. Compact gained room for the chapter name and
  the stage, and the base screen's top padding follows the island's measured
  height in every state, so nothing is ever covered.
- **Expanded island states progress**: `Step 2 of 5` and `38% through your plan`
  above the mini timeline, which previously read as an unexplained stripe.
- **Stuck alert.** Missing the same term twice puts the island into an alert —
  `"Impression, Sunrise" is costing you time.` — with `Save it for later` and
  `Keep trying`. It fires once per term, and it is the moment the hard question
  in each set was planted for.
- **No browser-locale strings anywhere.** The native `<input type="date">` and
  `<input type="time">` are gone, replaced by an in-page calendar (English month
  and weekday names, past days disabled) and a clock panel (hour grid, quarter
  minutes, AM/PM). Every visible string is now authored by the project.
- **The coach mark is strictly once per session**, across all four chapters.

## Checked across the app

Island present on Flashcards, Learn, Test, test setup and both completion
screens; absent on the folder and set-overview pages, which are browsing rather
than studying (the folder page has the spotlight instead), and absent on the
overlay's own full screens — exam setup, plan, chapter done, sprint done —
which already own the whole canvas. Its left edge lines up with the body text
of the screen beneath it. No CJK characters anywhere in the source or in the
rendered text of any screen.

---

# Round 4 — "save for later" could not be undone

Two bugs made saved questions a one-way trip, which broke the third thing the
prototype exists to test.

- **Tapping a saved question deleted it.** The row handler removed the term from
  `chapter.parked` and stopped there. Parking had already taken the question out
  of the Learn queue, so the tap left it in neither place, and `missedAndParked`
  no longer saw it either — it was gone from the final review too. The row is
  now a real `Do now`: it unparks the term, rebuilds its question and slots it
  in at the front of what is left, so it comes up immediately.
- **"Work on these now" only looked at the current chapter.** The sheet lists
  saves from every chapter, but the footer read `activeChapter().parked`. Saving
  something in Chapter 1 and pressing the button in Chapter 2 silently did
  nothing. It now collects every chapter's saves, and says how many it will
  work: `Work on all 3 now · 5 min`.

Two things had to follow from that:

- A saved question can now be answered inside a later chapter's round, so
  questions carry `chapterOrder`. Misses and the stuck alert are recorded
  against the chapter the term came from, while the pace counter stays with the
  chapter whose budget is actually running.
- During the final review the saves are already in the test queue, so the sheet
  drops the footer button for a line that says so, and the rows read `Remove`
  rather than `Do now`.
