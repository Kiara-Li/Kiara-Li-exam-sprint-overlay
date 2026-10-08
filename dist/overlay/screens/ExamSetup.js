import { course } from '../../base/data.js';
import { icon } from '../../base/components/icons.js';
import { checkGlyph, clockGlyph } from '../components/glyphs.js';
import { dateTimePicker } from '../components/DateTimePicker.js';
import { formatDuration } from '../state/clock.js';
import { CHAPTER_TERM_COUNT } from '../state/sprintPlan.js';
import { actionButton, choiceChip } from '../../system/components.js';

// Short list only. "In 1 hr" was never a realistic exam window for four sets.
const CHIPS = [
  { key: 'hour6', label: 'In 6 hours' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'tomorrow', label: 'Tomorrow 9 AM' },
];

/** Tomorrow at 9am: the most common answer, and always in the future. */
export function defaultDraft(now) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

export function examSetup(setup, now) {
  const sets = course.sets;
  const hasSets = sets.length > 0;
  const ready = hasSets && setup.examAt !== null && setup.examAt > now && setup.selected.length > 0;
  const draft = setup.examAt ?? setup.draftAt ?? defaultDraft(now);

  const chips = CHIPS.map((chip) => choiceChip({ label: chip.label, action: 'exam-chip', key: chip.key, selected: setup.chipKey === chip.key })).join('');

  const countdown = setup.error
    ? `<p class="ov-inline-warning" id="exam-time-error" role="alert">${setup.error}</p>`
    : setup.examAt
      ? `<p class="ov-countdown"><span>That gives you</span><strong>${formatDuration((setup.examAt - now) / 60000)}</strong></p>`
      : '<p class="ov-inline-note">Pick a date and time to see how long you have.</p>';

  const chapterRows = sets
    .map((set, index) => {
      const checked = setup.selected.includes(index);
      return `
        <button class="set-list-item ov-check-row${checked ? ' is-checked' : ''}" data-ov="toggle-chapter" data-chapter="${index}" aria-pressed="${checked}">
          <span class="set-icon">${icon('set-cyan')}</span>
          <span class="set-copy">
            <strong>${set.chapter}</strong>
            <small>${Math.min(CHAPTER_TERM_COUNT, set.terms.length)} cards</small>
          </span>
          <span class="ov-checkbox">${checked ? checkGlyph() : ''}</span>
        </button>`;
    })
    .join('');

  const shakyChips = sets
    .map(
      (set, index) => choiceChip({ label: set.chapter.split('·')[0].trim(), action: 'toggle-shaky', chapter: index, selected: setup.shaky.includes(index) }),
    )
    .join('');

  return `
    <main class="screen ov-screen ov-setup-screen">
      <header class="app-header ov-modal-header">
        <button class="ov-text-button" data-ov="cancel-setup">Cancel</button>
        <div class="app-header-title"></div>
        <span class="header-spacer"></span>
      </header>

      <section class="ov-setup-content">
        <div class="ov-setup-mark">${clockGlyph('ov-glyph-lg')}</div>
        <h1>When’s your exam?</h1>
        <p class="ov-setup-lede">We’ll split the time you have left across your sets.</p>

        ${dateTimePicker({ draft, open: setup.picker, monthAnchor: setup.monthAnchor, now, invalid: Boolean(setup.error) })}
        ${countdown}

        <div class="ov-chip-row ov-quick-row">${chips}</div>

        ${
          hasSets
            ? `<h2 class="ov-section-title">Which sets are you studying?</h2>
               <div class="ov-card">${chapterRows}</div>`
            : `<div class="ov-card ov-empty">
                 <p>Add a set to this folder to make a plan</p>
                 <button class="soft-button ov-full" data-ov="cancel-setup">Add a set</button>
               </div>`
        }
        ${hasSets && !setup.selected.length ? '<p class="ov-inline-warning">Pick at least one set</p>' : ''}

        ${
          hasSets
            ? `<h2 class="ov-section-title">Any you don’t feel ready for?</h2>
               <p class="ov-section-note">Tap them and we’ll give those sets more time.</p>
               <div class="ov-chip-row">${shakyChips}</div>`
            : ''
        }
      </section>

      <div class="sticky-action ov-setup-action">
        ${actionButton({ label: 'Make my plan', action: 'make-plan', disabled: !ready })}
      </div>
    </main>`;
}

export function resolveChip(key, now) {
  const date = new Date(now);
  if (key === 'hour6') return now + 6 * 60 * 60000;
  if (key === 'tonight') {
    date.setHours(21, 0, 0, 0);
    return date.getTime() > now ? date.getTime() : now + 6 * 60 * 60000;
  }
  if (key === 'tomorrow') {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date.getTime();
  }
  return null;
}
