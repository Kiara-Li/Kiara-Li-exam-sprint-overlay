# Exam Sprint design system

Open `design-system.html` from the repository root or `dist/design-system.html`.
The prototype's System link opens it separately without resetting the session.

## Sources and scope

- [Quizlet Assembly, by its lead designer Christian Dorian](https://www.christiandorian.com/assembly-design-system), inspected October 7, 2026. The public case study documents reference → system → component tokens and shows pill-shaped button variants, states, coachmarks, and content rows. This is a first-party designer case study, not a full public component specification.
- Its `illo-tokens-1.png` reference chart verifies Twilight 100 `#edefff`, 400 `#7583ff`, 500 `#4255ff`, 600 `#423ed8`; Gray 200 `#f6f7fb`, 300 `#edeff3`, 400 `#d9dde8`, 500 `#939bb4`, 600 `#586380`, 800 `#282e3e`. These values now replace the corresponding approximate base colors. The use of Twilight 600 for hover is this project's mapping.
- [Quizlet's brand refresh](https://quizlet.com/blog/brand-refresh-quizlet) provides historical brand context, not exact current UI specifications.
- [Design Systems Surf](https://designsystems.surf/) is the user's reference for organizing foundations, components, and patterns.
- Existing `base/` code supplies the reconstructed Quizlet mobile study layouts and local screenshot-derived icons. Its Hurme/Avenir/Arial fallback stack is retained; no proprietary font is bundled. Exact typography and spacing values remain prototype decisions, not claimed official Quizlet measurements.

## Shared decisions

- `base/tokens.css`: reference values. Imports the semantic definitions.
- `system/tokens.css`: heading, body, label; primary action, primary text, supporting text; related/control/content/section spacing (8/16/24/32px); component roles for shape, interaction, and feedback.
- `system/components.css`: common actions, chips, date fields, and Sprint visual alignment. Loaded last by `overlay/overlay.css`, which now contains imports only. Overlay scaffolding and gestures remain in `overlay/layout.css`.
- `system/components.js`: shared action and choice renderers. The simplified gallery displays action states, the date/time picker, and answer cards using production renderers.
- `showcase.*`: documentation layout and isolated sample interactions. They never import the application controllers or write prototype session state.

The presentation page is intentionally minimal: user-supplied logotype, three type roles, Primary / Secondary / Body color specimens, four spacing values, and components. The Secondary specimen uses the existing soft-action surface, not a new palette. References stay in this developer README only. Sprint patterns and explanatory sections are omitted from the page. The retained date/time picker is project-authored, not claimed to be an official Quizlet component.

## Usage

Use a filled primary action for the main decision, a soft secondary action for an alternative, and text for a lighter action. Default actions retain the base's 22px label; compact study actions use 18px and timer actions use 14px. Labels have explicit selected, disabled, focus, and loading states. Use `aria-pressed` on choices and associate invalid fields with an error message.

Use green for completed/saved time and orange for an attention state. An empty saved list or zero terms left is neutral. Chapter identity colors are separate from feedback. Keep explanatory words alongside color.

The timer's dark surface is a Sprint extension. It reuses the Gray 800 surface and the inverse-control pattern visible in the public Assembly examples; it is not represented as an official Quizlet timer.

Visual QA also found the timer had no expanded-state layout rule in the existing CSS. Expanded and alert states now reveal their controls, and a ResizeObserver keeps the content gutter below the timer while its height changes.

## Maintenance

The project owner maintains shared tokens/components, documents a changed decision here, and removes obsolete rules. Validate changes in setup, the plan, active study, saved questions, and completion, including small screens and keyboard focus. Keep Original/Sprint switching and the reversible saved-question behavior intact.

No new user-test evidence is claimed by this visual-system iteration. Commit and publication require the user's separate review.

## Isolated sorting motion study

The `#sorting` section imports `sorting-demo.css` and `sorting-demo.js`. It uses the same three-outcome controls, queue positions, pace bar, and card-flight helper as the Final Chapter 1 study flow. Orange / purple / green are semantic Sprint sort colors; there are no spaced-repetition intervals in this round. A swipe selects the left or right outcome; the middle outcome is button-only. The specimen's four sample cards and restart control are local to the design-system page and do not modify the study session.
