import { course } from '../../base/data.js';
import { icon } from '../../base/components/icons.js';
import { checkGlyph, clockGlyph } from '../components/glyphs.js';
import { dateTimePicker } from '../components/DateTimePicker.js';
import { formatDuration } from '../state/clock.js';
import { CHAPTER_TERM_COUNT, recommendStudy } from '../state/sprintPlan.js';
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
        ${step === 3 ? studyTimeStep(setup, now, { entering: fromStep !== step }) : ''}
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

/**
 * The bar's range. It is the time you have, but a 28-hour exam window would
 * leave a 90-minute plan as a sliver, so the bar shows a workable range and
 * marks the rest of the time with a hatched end.
 */
export function studyScale(advice, chosen) {
  const workable = Math.max(240, Math.ceil((advice.recommended * 3) / 15) * 15);
  let scale = Math.min(advice.max, workable);
  if (chosen > scale) scale = Math.min(advice.max, Math.ceil((chosen * 1.5) / 15) * 15);
  return { scale: Math.max(1, scale), more: advice.max > scale };
}

/** "28 hr" a day away, "1 hr 50 min" when it is close. */
function examInLabel(minutes) {
  return minutes >= 180 ? `${Math.floor(minutes / 60)} hr` : formatDuration(minutes);
}

function studyTimeStep(setup, now, { entering = false } = {}) {
  const study = chosenStudyMinutes(setup, now);
  const { chosen, min, max, tight, untilExam } = study;
  const custom = setup.studyMinutes != null && setup.studyMinutes !== study.recommended;
  const { scale, more } = studyScale(study, chosen);
  const fill = Math.min(100, (chosen / scale) * 100);
  const recommendationPosition = Math.min(100, study.recommended / scale * 100);
  const hours = Math.floor(chosen / 60);
  const minutes = chosen % 60;

  return `
    <h1>How long can you study?</h1>
    <div class="ov-study-card${entering ? ' is-entering' : ''}">
      <div class="ov-study-clock">
        <label class="ov-study-unit">
          <input type="number" inputmode="numeric" min="0" max="99" value="${hours}" data-study-input="hours" aria-label="Hours">
          <span>hr</span>
        </label>
        <label class="ov-study-unit">
          <input type="number" inputmode="numeric" min="0" max="59" value="${String(minutes).padStart(2, '0')}" data-study-input="minutes" aria-label="Minutes">
          <span>min</span>
        </label>
      </div>
      <div class="ov-study-track${more ? ' has-more' : ''}" data-study-track data-scale="${scale}" data-min="${min}" data-max="${Math.min(max, scale)}" style="--study-fill:${fill}%">
        <div class="ov-study-usable">
          <span class="ov-study-fill">
            <span class="ov-study-thumb" role="slider" tabindex="0" aria-label="Study time" aria-valuemin="${min}" aria-valuemax="${Math.min(max, scale)}" aria-valuenow="${chosen}" aria-valuetext="${formatDuration(chosen)}"></span>
          </span>
        </div>
        ${more ? '<span class="ov-study-more" aria-hidden="true"></span>' : ''}
      </div>
      <div class="ov-study-ruler${more ? ' has-more' : ''}${recommendationPosition > 60 ? ' is-near-end' : ''}">
        <div class="ov-study-recommendation-range" style="--recommended-position:${recommendationPosition}%">
          <span class="ov-study-recommendation-tick" aria-hidden="true"></span>
          <button type="button" class="ov-study-recommendation${custom ? '' : ' is-selected'}" data-ov="study-recommended" aria-label="Use recommended study time: ${formatDuration(study.recommended)}" aria-pressed="${!custom}">Recommended</button>
        </div>
        <p class="ov-study-scale">Exam in ${examInLabel(untilExam)}</p>
      </div>
    </div>
    ${tight ? '<p class="ov-study-tight">Tight. Less-ready sets go first.</p>' : ''}`;
}

/** On arrival the digits count up while the blue slides out to the plan. */
export function playStudyIntro(root) {
  const card = root?.querySelector('.ov-study-card.is-entering');
  if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hoursInput = card.querySelector('[data-study-input="hours"]');
  const minutesInput = card.querySelector('[data-study-input="minutes"]');
  const total = Number(hoursInput.value) * 60 + Number(minutesInput.value);
  const start = performance.now() + 250;
  const length = 1000;
  const step = (now) => {
    const t = Math.min(1, Math.max(0, (now - start) / length));
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round((total * eased) / 5) * 5;
    const shown = t >= 1 ? total : Math.min(total, value);
    hoursInput.value = String(Math.floor(shown / 60));
    minutesInput.value = String(shown % 60).padStart(2, '0');
    if (t < 1) requestAnimationFrame(step);
    else card.classList.remove('is-entering');
  };
  requestAnimationFrame(step);
}
