import { course } from '../../base/data.js';
import { icon } from '../../base/components/icons.js';
import { checkGlyph, clockGlyph } from '../components/glyphs.js';
import { dateTimePicker } from '../components/DateTimePicker.js';
import { formatDuration } from '../state/clock.js';
import { CHAPTER_TERM_COUNT, chapterWeight, recommendStudy } from '../state/sprintPlan.js';
import { chapterColor } from '../components/PlanTimeline.js';
import { actionButton } from '../../system/components.js';

const STEPS = 4;

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

  // Only when the exam is. It must not read like study time.
  const countdown = setup.error
    ? `<p class="ov-inline-warning" id="exam-time-error" role="alert">${setup.error}</p>`
    : setup.examAt
      ? `<p class="ov-countdown"><span>Your exam is in</span><strong>${formatDuration((setup.examAt - now) / 60000)}</strong></p>`
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
            <span class="ov-shaky-number" style="--chapter-color:${chapterColor(index)}">${index + 1}</span>
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
  const toPercent = ((step + 1) / STEPS) * 100;
  const fromPercent = ((fromStep + 1) / STEPS) * 100;
  const last = step === STEPS - 1;

  return `
    <main class="screen ov-screen ov-setup-screen">
      <header class="app-header ov-modal-header ov-setup-header">
        <button type="button" class="icon-button ov-setup-back" data-ov="${step ? 'setup-back' : 'cancel-setup'}" aria-label="${step ? 'Back' : 'Cancel'}">${icon('back')}</button>
        <div class="ov-setup-progress" role="progressbar" aria-label="Exam setup progress" aria-valuemin="1" aria-valuemax="${STEPS}" aria-valuenow="${step + 1}">
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
        ${step === 3 ? studyTimeStep(setup, now) : ''}
      </section>

      <div class="sticky-action ov-setup-action">
        ${actionButton({ label: last ? 'Make my plan' : 'Continue', action: last ? 'make-plan' : 'setup-next', disabled: !ready })}
      </div>
    </main>`;
}

/** The study time the user will plan with: their pick, or the recommendation. */
export function chosenStudyMinutes(setup, now) {
  const advice = recommendStudy({ sets: course.sets, selected: setup.selected, shaky: setup.shaky, examAt: setup.examAt, now });
  const chosen = setup.studyMinutes == null
    ? advice.recommended
    : Math.max(advice.min, Math.min(advice.max, setup.studyMinutes));
  return { ...advice, chosen, tight: chosen < advice.estimate };
}

// Ring geometry in SVG user units, matching the plan donut.
const VIEW = 100;
const CENTRE = VIEW / 2;
const RADIUS = 38;
const THICKNESS = 12;
const GAP = 1.4;

/** The picked chapters, split the way the plan will split them. */
function studyRing(setup) {
  const circumference = 2 * Math.PI * RADIUS;
  const slices = setup.selected.map((setIndex) => ({ setIndex, weight: chapterWeight(setup.shaky.includes(setIndex)) }));
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0) || 1;
  let offset = 0;
  return slices
    .map((slice) => {
      const fraction = slice.weight / total;
      const length = Math.max(0, circumference * fraction - GAP);
      const arc = `<circle class="ov-study-arc" cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}" stroke="${chapterColor(slice.setIndex)}" stroke-width="${THICKNESS}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" />`;
      offset += circumference * fraction;
      return arc;
    })
    .join('');
}

function studyTimeStep(setup, now) {
  const { chosen, min, max, tight } = chosenStudyMinutes(setup, now);
  const custom = setup.studyMinutes != null && setup.studyMinutes !== chosenStudyMinutes({ ...setup, studyMinutes: null }, now).chosen;
  return `
    <h1>How long can you study?</h1>
    <div class="ov-study">
      <div class="ov-study-ring">
        <svg viewBox="0 0 ${VIEW} ${VIEW}" aria-hidden="true">
          <circle class="ov-study-track" cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}" stroke-width="${THICKNESS}" />
          <g class="ov-study-arcs">${studyRing(setup)}</g>
        </svg>
        <div class="ov-study-centre">
          <strong class="ov-study-time" aria-live="polite">${formatDuration(chosen)}</strong>
          ${custom
            ? '<button type="button" class="ov-study-reset" data-ov="study-recommended">Back to recommended</button>'
            : '<span class="ov-study-tag">Recommended</span>'}
        </div>
      </div>
      <div class="ov-study-steppers">
        <button type="button" class="ov-study-step" data-ov="study-step" data-delta="-15" aria-label="15 minutes less" ${chosen <= min ? 'disabled' : ''}>−</button>
        <button type="button" class="ov-study-step" data-ov="study-step" data-delta="15" aria-label="15 minutes more" ${chosen >= max ? 'disabled' : ''}>+</button>
      </div>
      ${tight ? '<p class="ov-study-tight">Tight. Less-ready sets go first.</p>' : ''}
    </div>`;
}
