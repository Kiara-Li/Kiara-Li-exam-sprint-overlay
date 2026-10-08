# Fixes Based on Feedback

Smaller fixes from user testing. Independent of `ITERATION-SPEC.md` and `OPPORTUNITY-2-SPEC.md`; can be built before or after them.

## Scope

- **Sprint mode only.** `?mode=original` stays exactly as it is, including Quizlet's original colors, the speaker icon and the Study all button. It is the comparison version.
- **Chapter 1 only** wherever a fix touches study screens.
- Don't change base behavior; add the smallest hook if needed.
- New colors go in `tokens.overlay.css` as semantic tokens, not raw values.

---

## 1. Entry point: replace Study all with Prepare for exam

One tester never found the exam flow. She tapped into flashcards and studied the whole way through. The current chooser sheet and the dimmed spotlight around Study all didn't stop that.

- On the folder page, replace the `Study all` button with **`Prepare for exam`**. Same position, same button style.
- Add a small `Start here` tag pointing at it, in Quizlet's tag style. It shows until the user taps the button once.
- **Remove the StudyChooser sheet entirely.** Tapping `Prepare for exam` goes straight to the exam setup screen (`When's the exam?`).
- Remove the spotlight dimming around the old button.

---

## 2. Right and wrong answers: make them clear, and give wrong its own color

In testing, one tester said it wasn't visually clear whether her answer was right or wrong, and another read the dark orange as "you're getting it wrong" even when she wasn't. Quizlet uses the same orange for Learn progress and for wrong answers.

### New token

- `--feedback-wrong`: red, clearly different from the orange used elsewhere.
- `--feedback-wrong-surface`: a light tint of that red for backgrounds.

### Answer states in Learn

| State | Border | Background | Icon |
|---|---|---|---|
| Correct | solid green (`--color-success-dark`) | light green (`--color-surface-green`) | check |
| Wrong (the one chosen) | solid red (`--feedback-wrong`) | light red (`--feedback-wrong-surface`) | X in red |

- The `Not quite, you're still learning!` title uses `--feedback-wrong`, not orange.
- Correct answers auto-advance after about 800 ms (from `ITERATION-SPEC.md`), so the correct state must be readable at a glance in that time.

### Progress bar

- The progress bar **must not change color because of a right or wrong answer.** Right and wrong only show on the answers themselves.
- Its actual color is not decided yet. Don't change it in this round beyond removing any reaction to right or wrong.

---

## 3. No layout jump after answering

One tester said the boxes change size too much. When an answer is wrong, `.quiz-wrong` increases the minimum heights of the question area (`padding-top`, `padding-bottom`, `h1 min-height`) and of the answer cards (`min-height`, `font-size`), so the whole screen shifts.

- In sprint mode, the question, answer cards and spacing stay the **same size before and after answering**, right or wrong.
- Only color, border, icon and the feedback title change.
- The feedback title should take up space that's already reserved, so nothing below it moves.

---

## 4. Back button: confirm and keep progress

Pressing back wiped a tester's progress with no warning, and she had to start over.

- In sprint mode, pressing back or close during flashcards or Learn opens a confirmation sheet (reuse the existing sheet style):
  - Title: `Leave this session?`
  - Body: `Your progress will be saved.`
  - Buttons: `Keep studying` (primary), `Leave` (secondary)
- If the user leaves, **keep the sprint state** (current stage, queue, sorts, time used). Returning via `Prepare for exam` asks `Pick up where you left off?` with `Continue` / `Start over`.
- The sprint clock pauses while the user is out of the session.

---

## 5. Remove the speaker icon

The speaker icon on flashcards doesn't do anything, and a tester asked what it was.

- In sprint mode, remove the speaker icon from both sides of the flashcard.

---

## 6. Logging

- `entry` when `Prepare for exam` is tapped, with `{ firstTap: true | false }`
- `leave-prompt` with `{ choice: 'keep' | 'leave' }`
- `resume-prompt` with `{ choice: 'continue' | 'restart' }`

---

## Done when

- [ ] Folder page shows `Prepare for exam` with a `Start here` tag; no Study all, no chooser sheet, no spotlight
- [ ] Tapping it goes straight to `When's the exam?`
- [ ] Correct = solid green border + light green fill; wrong = red border + light red fill + red X
- [ ] `Not quite` title is red
- [ ] Progress bar never changes color because of an answer
- [ ] Nothing on the Learn screen moves or resizes after answering
- [ ] Back asks to confirm, progress is kept, and returning offers to continue
- [ ] Speaker icon removed in sprint mode
- [ ] `?mode=original` unchanged

When finished, list anything you had to guess.
