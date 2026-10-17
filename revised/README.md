# Revised prototype

A copy of `final/`, made on October 16, 2026, for changes based on the feedback from the October 15 presentation. `final/` and its Demo stay as they were presented; this version is where the feedback is tried out before anything is merged back.

Open `revised/index.html` through the local preview server, or pick **Revised** in the toolbar. It always runs on the Demo's animal sets. The System link opens this version's own design-system page.

## What changed from Final

Setup is three steps instead of four, and the time questions come first:

1. **When's your exam?** Tiles for Tomorrow / In 2 days / In 3 days, with Other opening the calendar. The time is a field that opens the wheels. The countdown reads in days once the exam is a day or more away.
2. **How long can you study?** Moved up from the last step. The recommendation starts from every set at the level its past progress suggests and follows the next step until the user sets a time of their own.
3. **How well do you know each set?** Replaces "Which sets are you studying?" and "Any sets you feel less ready for?". Each set shows its past progress (mastered / still learning / not studied) and one switch: Shaky (more time), Skip (not in this plan), Know it (less time). The default comes from that progress. Chapter 1 cannot be skipped, since it is the set this prototype runs.

The plan, study screens and everything after are unchanged from Final.

## Study modes (replaces the pace ball)

The goal ball and its intro are gone; the bar only counts cards. Time is checked at half way and at the end of each stage's planned time. Behind at either point, a **Speed up** pill appears in the header; when the set's whole time is used, a **Wrap up** pill appears. Nothing covers the card: the user taps the pill or simply keeps going. A card sent back twice in a row is saved for the end automatically.

- **Speed-up** — Flashcards show both sides with only Don't know / Got it, and cards mastered before are skipped. Quiz drops to two choices, sends wrong answers to the back by itself, moves on faster after a right answer, and skips cards already got in Flashcards. A cyan band and a Speed-up pill (tap to go back to normal) mark the mode.
- **Last pass** — everything not yet got, on one page; "I've read these" ends the set and saves those cards for final review.

Chapter 1 ends one of three ways: on time, "Done the fast way" (Speed-up cards saved for review), or "Time's up, you're covered" (Last pass cards saved for review). The intro before studying now explains the three modes.
