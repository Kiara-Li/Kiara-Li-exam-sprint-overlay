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

// The step the progress bar last showed. Toggling a set re-renders the whole
// screen, so the fill may only animate when the step itself has changed.
let renderedStep = null;

/** Tomorrow at 9am: the most common answer, and always in the future. */
export function defaultDraft(now) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

export function examSetup(setup, now) {
  const step = setup.step || 0;
  const sets = course.sets;
  const hasSets = sets.length > 0;
  const ready = hasSets && setup.examAt !== null && setup.examAt > now && setup.selected.length > 0;
  const draft = setup.examAt ?? setup.draftAt ?? defaultDraft(now);

  const chips = CHIPS.map((chip) => choiceChip({ label: chip.label, action: 'exam-chip', key: chip.key, selected: setup.chipKey === chip.key })).join('');

  const countdown = setup.error
    ? `<p class="ov-inline-warning" id="exam-time-error" role="alert">${setup.error}</p>`
    : setup.examAt
      ? `<p class="ov-countdown"><span>That gives you</span><strong>${formatDuration((setup.examAt - now) / 60000)}</strong></p>`
      : '';

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

  const shakyCards = sets
    .map((set, index) => {
      if (!setup.selected.includes(index)) return '';
      const on = setup.shaky.includes(index);
      const [short, ...rest] = set.chapter.split('·');
      return `
        <button type="button" class="ov-shaky-card${on ? ' is-selected' : ''}" data-ov="toggle-shaky" data-chapter="${index}" aria-pressed="${on}">
          <span class="ov-shaky-top">
            <span class="ov-shaky-number">${index + 1}</span>
            <span class="ov-shaky-check" aria-hidden="true">${on ? checkGlyph() : ''}</span>
          </span>
          <strong>${short.trim()}</strong>
          <small>${rest.join('·').trim()}</small>
        </button>`;
    })
    .join('');

  // A thin bar, not numbered pills. The fill starts where the last step left
  // it so moving between steps reads as progress rather than a redraw.
  const fromStep = renderedStep === null ? step : renderedStep;
  renderedStep = step;
  const toPercent = ((step + 1) / 3) * 100;
  const fromPercent = ((fromStep + 1) / 3) * 100;

  return `
    <main class="screen ov-screen ov-setup-screen">
      <header class="app-header ov-modal-header ov-setup-header">
        <button type="button" class="icon-button ov-setup-back" data-ov="${step ? 'setup-back' : 'cancel-setup'}" aria-label="${step ? 'Back' : 'Cancel'}">${icon('back')}</button>
        <div class="ov-setup-progress" role="progressbar" aria-label="Exam setup progress" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${step + 1}">
          <span style="--setup-from:${fromPercent}%;--setup-to:${toPercent}%"></span>
        </div>
        <span class="header-spacer"></span>
      </header>

      <section class="ov-setup-content ov-step-${step}">
        ${step === 0 ? `
        <div class="ov-setup-mark">${clockGlyph('ov-glyph-lg')}</div>
        <h1>When’s your exam?</h1>

        ${dateTimePicker({ draft, open: setup.picker, monthAnchor: setup.monthAnchor, now, invalid: Boolean(setup.error) })}
        ${countdown}

        <div class="ov-chip-row ov-quick-row">${chips}</div>
        ` : ''}
        ${step === 1 ? `
        <h1>Which sets are you studying?</h1>
        ${
          hasSets
            ? `<div class="ov-card">${chapterRows}</div>`
            : `<div class="ov-card ov-empty">
                 <p>Add a set to this folder to make a plan</p>
                 <button class="soft-button ov-full" data-ov="cancel-setup">Add a set</button>
               </div>`
        }
        ${hasSets && !setup.selected.length ? '<p class="ov-inline-warning">Pick at least one set</p>' : ''}
        ` : ''}
        ${step === 2 ? `
        <h1>Any sets you feel less ready for?</h1>
        ${hasSets ? `<div class="ov-shaky-grid">${shakyCards}</div>` : ''}
        ` : ''}
      </section>

      <div class="sticky-action ov-setup-action">
        ${actionButton({ label: step === 2 ? 'Make my plan' : 'Continue', action: step === 2 ? 'make-plan' : 'setup-next', disabled: !ready })}
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
