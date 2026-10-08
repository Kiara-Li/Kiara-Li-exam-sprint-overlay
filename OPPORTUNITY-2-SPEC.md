# Opportunity 2 Spec: Pacing Between Flashcards and Practice

Build this **after** `ITERATION-SPEC.md`. It uses the pace bar, the three-level sort, and the feedback toasts from that spec. Where the two overlap, this one wins: **section 2 here replaces section 6 of `ITERATION-SPEC.md`**.

## Scope

- **Chapter 1 only.** Chapters 2 to 4 are only referenced by name when time is moved to or from them.
- `?mode=original` stays exactly as it is.
- Same rule as before: don't change base behavior; add the smallest hook if needed.

## The one rule behind everything here

Time is the core of this feature. The exam time is fixed, so **any time added somewhere has to come from somewhere else, and the user is always told where.** Never add or remove time silently.

---

## 1. Plan screen: split each chapter into flashcards and practice

- Change the default split from 20% flashcards / 80% practice to **30% / 70%**. (In testing, both participants spent longer on flashcards than the old split assumed.)
- On PlanReady, each chapter's bar shows two segments: a lighter one labelled `Flashcards` and a full one labelled `Practice`, each with its minutes.
- Under the bars, one line: `Practice time adjusts after flashcards, based on what you mark.`
- The user does not edit the split here. The system sets it.
- Keep the pace marker explanation from `ITERATION-SPEC.md` section 4.

---

## 2. Transition page: flashcards → practice

Shown when the flashcard stage of Chapter 1 ends. Reuse the base flashcards "Done!" screen layout.

### Content, top to bottom

1. **Headline:** `Flashcards done.`
2. **Stat cards:** `Got it` (count) and `Needs more work` (count).
3. **Needs more work list:** the terms whose **last** sort in flashcards was `Don't know it` or `Kind of`. Show each term name as a row. If the list is empty, skip it.
4. **What this changes:** one or two lines, depending on the case below.
5. **Practice preview:** the pace bar for practice, with the weak terms' questions highlighted in their positions.
6. **Up next card:** `Practice: Chapter 1`, question count, minutes. Arrow continues to Learn.

### Time rules

- `practice time = chapter time − time actually spent on flashcards + weak bonus`
- `weak bonus = 1 min per weak term, max 4 min`
- The bonus is taken from the next chapter (Chapter 2). Use the existing `addTime` in `sprintPlan.js` with Chapter 2 as donor, so the plan numbers really change.
- If flashcards took longer than planned, that shows up as less practice time. Say so.

### Copy for each case

| Case | "What this changes" line |
|---|---|
| Some weak terms | `These 3 come first in practice, and you'll see each twice. Practice gets 3 extra minutes, taken from Chapter 2.` |
| No weak terms | `You've got all of these. Practice is 2 minutes shorter, and the time goes to Chapter 2.` (Give back 15% of practice time, rounded.) |
| Flashcards ran over | Add: `Flashcards took 4 minutes longer than planned, so practice is a little shorter.` |

Numbers in the copy come from the real calculation.

---

## 3. Practice queue weighting

- Questions for weak terms go **first** in the Learn queue, in the order they were marked.
- Each weak term gets a **second question later in the queue**. Asked the other way round (term ↔ definition) if the question generator supports it; otherwise the same question again, placed after at least 3 other questions.
- All other terms follow in their normal order.

---

## 4. When the user gets stuck on a question

### Detecting it

A question counts as stuck when either:

- the user has been on it for **45 seconds** without answering, or
- it's a question that already came back after a wrong answer, and they've been on it for **25 seconds**.

### What happens

There are two pools of extra time:

- **Weak-term time:** the weak bonus from section 2, already set aside for these terms.
- **Buffer:** a reserve of **10% of the chapter's time**, set aside when the plan is built. Not shown on the plan screen.

| Situation | Message | Marker |
|---|---|---|
| Stuck on a weak term | `This is one you marked earlier. We kept extra time for it.` | Pauses for up to 2 min |
| Stuck on any other question, buffer left | `This one needs more thought. We've added 2 minutes for it.` (2 min taken from the buffer) | Pauses for up to 2 min |
| Stuck, buffer used up | `You're spending a while here. Move it later?` with `Move it later` / `Keep going` | Keeps moving |

`Move it later` applies the **later** sort from `ITERATION-SPEC.md`.

### Marker behavior

- **Pausing** means the marker stops advancing while the extra time runs. It never jumps backward.
- When it pauses, a small label appears next to it for 2 seconds: `+2 min`.
- The pause ends when the user answers or the extra time runs out, whichever comes first.

### Hints

When a question is first detected as stuck, a small hint button appears in the top right of the question card (Quizlet icon style, a lightbulb or similar). Two steps, one tap each:

1. **First tap:** one wrong answer is struck through and disabled. Button label: `Hint`.
2. **Second tap:** `Peek at the card` opens that term's flashcard as a sheet. Closing it returns to the question.

If the user peeked, the question is automatically sorted **later** after they answer it, whether they get it right or not. Seeing the answer doesn't count as knowing it.

---

## 5. Message rules

There are now several kinds of messages. To keep them from piling up:

- **One message on screen at a time.**
- At least **30 seconds** between messages that don't need a decision.
- Messages that need a decision (`Move it later?`) can appear any time, but only one can be open.
- Never show the same message twice in a row.

---

## 6. Logging

Add to the session log:

- `transition-shown` with `{ gotIt, weak, weakTerms, practiceMinutes, bonus, donor }`
- `stuck` with `{ termIndex, reason: 'time' | 'returned', pool: 'weak' | 'buffer' | 'none' }`
- `marker-pause` with `{ minutes }`
- `hint` with `{ termIndex, step: 1 | 2 }`
- `stuck-choice` with `{ choice }`

---

## Done when

- [ ] Plan screen shows a flashcards / practice split per chapter at 30 / 70
- [ ] Transition page appears after Chapter 1 flashcards with the right case copy and real numbers
- [ ] Weak bonus actually moves minutes from Chapter 2, and the plan reflects it
- [ ] Weak terms come first in practice and each appears twice
- [ ] Stuck detection works for both triggers
- [ ] Marker pauses (never jumps back) and shows `+2 min`
- [ ] Buffer runs out and the message switches to `Move it later?`
- [ ] Hint step 1 strikes a wrong answer; step 2 opens the card; peeked questions come back
- [ ] Only one message at a time, 30 s spacing respected
- [ ] `?mode=original` unchanged

When finished, list anything you had to guess.
