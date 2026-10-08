# Iteration Spec: Sorting + Pace Bar

Round 2 changes to the Exam Sprint overlay, based on user testing. Read all of it before writing code.

## Scope

- **Chapter 1 only.** Do not build, change or test anything for Chapters 2 to 4. They can stay as they are or be hidden in sprint mode.
- `?mode=original` must stay exactly as it is now.
- Follow the existing rule: do not change base behavior. If base needs a hook, add the smallest possible one and keep the default behavior unchanged.

## What this round is for

Testing showed three things:

1. The floating timer was read as the phone's own clock and ignored.
2. Repeat / Hard / Okay / Easy confused both testers. Their real intervals (5 minutes, 6 days, 2 weeks, 1 month) make no sense when the exam is tomorrow, and on the last card Repeat trapped one tester with no way forward.
3. Review Card, Save for later and Continue were crowded together, and Save for later felt unnatural.

This round replaces all of that with **one action (sorting) and one element (the pace bar)**, used the same way in flashcards and in Learn.

---

## 1. Remove

In sprint mode, during study (flashcards and Learn):

- The Island, in every state. Do not render it on study screens.
- The orange and green counters at the top of the flashcard screen (`.mastery-counts`). These belong to Quizlet's Basic sorting mode. This prototype uses one mode only.
- Every Save for later button (`.ov-save-later`, `data-ov="park-button"`).
- The "Review this card" link (`.ov-review-link`).
- The coach mark "Swipe the question up to save it for later" and the swipe-up parking gesture.
- The interval labels under the rating buttons (`≤1 min`, `≤5 min`, etc.).

Keep the setup flow and the plan screen. Changes to the plan screen are in section 4.

---

## 2. Sorting: three levels

Final review is not part of this round, so sorting has **three** levels, not four. Labels describe how well the user knows the item. A short line underneath says what happens next. No minutes, no days.

| Level | Button label | Small text underneath | What happens |
|---|---|---|---|
| again | Don't know it | Back in a moment | Reinserted 2 items later in the current queue |
| later | Kind of | Later in this set | Reinserted at the end of the current queue |
| done | Got it | Done for now | Removed from the queue |

Colors (reuse Quizlet's Spaced Repetition rating colors, as semantic tokens in `tokens.overlay.css`, aliasing existing base colors where possible):

- `--sort-again`: orange
- `--sort-later`: purple
- `--sort-done`: green

The color shows on the button and on the card while it is being dragged toward that side. It never appears as a static counter.

### Flashcards

- Replace the four-button strip with the three buttons above.
- Swipe still works: drag left past threshold = **again**, drag right past threshold = **done**. **later** is button only. Remove the two-strength swipe (`strongSwipeThreshold`) so swipe distance never silently picks a different level.
- Update the caption under the buttons to: `Swipe left if you don't know it · Swipe right when you've got it`.

### Learn (multiple choice)

- **Correct answer:** show the existing green correct state for about 800 ms, then advance automatically. The question counts as **done** and leaves the queue. No button.
- **Wrong answer:** show the existing "Not quite, you're still learning!" state with the correct answer marked. Then, in place of the Continue button, show the sort strip with **two** options only: `Don't know it` (again) and `Kind of` (later). Choosing one is what moves the user on. There is no Continue button on a wrong answer anymore.
- The whole question card can also be dragged: left = again. Drag right on a wrong answer = later.
- Replace base's own retry rule (`advanceLearn` pushes a wrong question once to the end) with the sort result in sprint mode, so a question isn't requeued twice.

### Never trapped

- **done** always removes the item, so a user who keeps choosing it can always finish.
- If the same item gets **again** twice in a row, show a feedback message (section 5): `This one keeps coming back. Move it later?` with `Move it later` and `Keep it close`. `Move it later` applies **later** to it.
- If **again** is chosen on the last item in the queue, it comes back immediately once. If chosen again on that same last item, apply the message above instead of looping.

### Sort animation

When an item is sorted, it should look like it is being put somewhere on the pace bar:

- The card shrinks and flies up into the pace bar (about 350 ms).
- It lands at the position where it will come back: a few segments ahead for **again**, at the end of the bar for **later**. A short highlighted slice appears there.
- For **done**, the card fades into the completed part of the bar and that segment fills in.

### First-time hint

The first time the sort strip appears in flashcards, and the first time it appears in Learn, show one short line above the strip: `Sort it by how well you know it. We'll bring it back when it's useful.` Dismiss on any interaction. Show each once only.

---

## 3. The pace bar

Replaces the thin progress line at the top of the flashcard screen and the segmented progress bar in Learn. One bar only.

### Layout

- The bar sits higher, directly under the header.
- The `5 / 8` count moves down, closer to the card or question.

### What it shows

- One segment per item in the current queue (flashcards or Learn). Completed items are filled. Reinserted items add segments, so the bar can grow.
- A highlighted slice marks each item the user has sorted to come back.
- **Pace marker:** a small tick on the bar showing where the user should be by now if they're on plan. Position = time used in this stage ÷ time planned for this stage × total segments. It moves slowly as time passes.

No minutes or seconds anywhere on the study screens.

---

## 4. Explain the pace marker on the plan screen

On PlanReady, under the plan and above `Start`, add a small example of the bar with the marker and one line:

> Keep up with the marker and you're on pace. No need to watch the clock.

Remove `Your plan adjusts as you go.` if it no longer fits.

---

## 5. Feedback messages

With the Island gone, messages appear as a small toast directly under the pace bar. One at a time, 3 seconds, then fade. Use existing Learn feedback styles (green for good, orange for warning). The decision message below stays until the user picks.

| When | Message |
|---|---|
| User is clearly ahead of the marker | `You're ahead of pace. Nice.` |
| User falls behind the marker by about 20% of the stage | `You're a little behind. Sort the hard ones later to keep moving.` |
| Same item gets **again** twice in a row | `This one keeps coming back. Move it later?` → `Move it later` / `Keep it close` |

Do not show the same message twice in a row.

---

## 6. Transition from flashcards to Learn

Both testers didn't notice when flashcards ended and practice began. Reuse the base flashcards "Done!" screen:

- Headline: `Flashcards done.`
- Stat cards: `Got it` (count) and `Coming back in practice` (count of again + later).
- Up next card: `Practice: Chapter 1`, arrow continues to Learn.

---

## 7. Logging

Add to the session log:

- `sort` with `{ stage, termIndex, level, via: 'button' | 'swipe' }`
- `auto-advance` on correct answers
- `pace-message` with which message was shown
- `stuck-prompt-choice`

---

## Done when

- [ ] `?mode=original` unchanged
- [ ] Chapter 1 runs end to end in sprint mode: setup → plan → flashcards → transition → Learn → chapter done
- [ ] No Island, no counters, no Save for later buttons, no interval labels on study screens
- [ ] Three-level sort works by button and swipe in flashcards
- [ ] Correct answers auto-advance; wrong answers show two-option sort instead of Continue
- [ ] No way to get stuck on a single card or question
- [ ] Pace bar grows with reinserted items and shows the pace marker
- [ ] Plan screen explains the marker
- [ ] Feedback toasts appear and don't repeat
- [ ] New sort colors are tokens in `tokens.overlay.css`, not raw values

When finished, list anything you had to guess.
