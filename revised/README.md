# Revised prototype

A copy of `final/`, made on October 16, 2026, for changes based on the feedback from the October 15 presentation. `final/` and its Demo stay as they were presented; this version is where the feedback is tried out before anything is merged back.

Open `revised/index.html` through the local preview server, or pick **Revised** in the toolbar. It always runs on the Demo's animal sets. The System link opens this version's own design-system page.

## What changed from Final

Setup is three steps instead of four, and the time questions come first:

1. **When's your exam?** Tiles for Tomorrow / In 2 days / In 3 days, with Other opening the calendar. The time is a field that opens the wheels. The countdown reads in days once the exam is a day or more away.
2. **How long can you study?** Moved up from the last step. The recommendation starts from every set at the level its past progress suggests and follows the next step until the user sets a time of their own.
3. **How well do you know each set?** Replaces "Which sets are you studying?" and "Any sets you feel less ready for?". Each set shows its past progress (mastered / still learning / not studied) and one switch: Shaky (more time), Skip (not in this plan), Know it (less time). The default comes from that progress. Chapter 1 cannot be skipped, since it is the set this prototype runs.

The plan, study screens and everything after are unchanged from Final.
