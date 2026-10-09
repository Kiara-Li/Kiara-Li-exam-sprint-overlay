import { formatDuration } from '../state/clock.js';
import { totalAllotted } from '../state/sprintPlan.js';
import { chapterColor } from './PlanTimeline.js';

// Geometry in SVG user units. The viewBox is unitless, so these are
// proportions of the drawing, not page sizes.
const VIEW = 100;
const CENTRE = VIEW / 2;
const RADIUS = 38;
const THICKNESS = 12;
const GAP = 1.4;

/** "28 hr" for a day away, "1 hr 50 min" when it is close enough to matter. */
function examIn(plan) {
  const minutes = Math.max(0, Math.round((plan.examAt - plan.startedAt) / 60000));
  // Whole hours, rounded down: 28 hr 34 min reads as "28 hr", per the spec.
  return minutes >= 180 ? `${Math.floor(minutes / 60)} hr` : formatDuration(minutes);
}

/**
 * One ring, one arc per chapter, hover or tap an arc to read its budget.
 * Easier to compare at a glance than a thin horizontal bar.
 */
export function planDonut(plan) {
  const total = totalAllotted(plan) || 1;
  const circumference = 2 * Math.PI * RADIUS;
  // One slice per chapter, then final review. Colour and number come from the
  // chapter itself, so they match the badges on the "less ready" step even
  // when an earlier chapter was left out.
  const slices = [
    ...plan.chapters
      .filter((chapter) => chapter.status !== 'skipped')
      .map((chapter) => ({
        key: String(chapter.order),
        number: chapter.setIndex + 1,
        name: chapter.short,
        detail: chapter.title.split('·').slice(1).join('·').trim(),
        minutes: chapter.allotted,
        color: chapterColor(chapter.setIndex),
        shaky: chapter.shaky,
      })),
    {
      key: 'final',
      number: 'FR',
      name: 'Final review',
      detail: 'Everything you missed or saved for later',
      minutes: plan.finalReview.allotted,
      color: 'var(--sprint-final)',
      shaky: false,
    },
  ].filter((slice) => slice.minutes > 0);

  let offset = 0;
  const arcs = slices
    .map((slice) => {
      const fraction = slice.minutes / total;
      const length = Math.max(0, circumference * fraction - GAP);
      const arc = `
        <circle
          class="ov-donut-arc"
          data-slice="${slice.key}"
          cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}"
          stroke="${slice.color}"
          stroke-width="${THICKNESS}"
          stroke-dasharray="${length} ${circumference - length}"
          stroke-dashoffset="${-offset}"
        ><title>${slice.name} · ${slice.minutes} min</title></circle>`;
      offset += circumference * fraction;
      return arc;
    })
    .join('');

  // Labels sit on the ring itself, so each wedge says which chapter it is.
  let labelOffset = 0;
  const labels = slices
    .map((slice) => {
      const fraction = slice.minutes / total;
      const angle = (labelOffset + (circumference * fraction) / 2) / circumference;
      labelOffset += circumference * fraction;
      const radians = angle * 2 * Math.PI - Math.PI / 2;
      const x = CENTRE + Math.cos(radians) * RADIUS;
      const y = CENTRE + Math.sin(radians) * RADIUS;
      const short = String(slice.number);
      if (fraction < 0.06) return '';
      return `<text class="ov-donut-label" data-slice="${slice.key}" x="${x}" y="${y}" dominant-baseline="central" text-anchor="middle">${short}</text>`;
    })
    .join('');

  const readout = slices
    .map(
      (slice, index) => `
        <span class="ov-donut-readout${index === 0 ? ' is-active' : ''}" data-readout="${slice.key}">
          <strong>${slice.name}</strong>
          <b>${formatDuration(slice.minutes)}</b>
          <small>${slice.detail}</small>
        </span>`,
    )
    .join('');

  // Large: the study time. It has to fit inside the ring's 64-unit hole.
  const studyLabel = formatDuration(total);
  const studySize = Math.min(15, 62 / (studyLabel.length * .56)).toFixed(2);

  return `
    <figure class="ov-donut" data-donut>
      <svg viewBox="0 0 ${VIEW} ${VIEW}" role="img" aria-label="Time split across the plan">
        <circle class="ov-donut-track" cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}" stroke-width="${THICKNESS}" />
        <g class="ov-donut-arcs">${arcs}</g>
        <g class="ov-donut-labels">${labels}</g>
        <text class="ov-donut-total" style="font-size:${studySize}px" x="${CENTRE}" y="${CENTRE - 1}" text-anchor="middle">${studyLabel}</text>
        <text class="ov-donut-total-note" x="${CENTRE}" y="${CENTRE + 10}" text-anchor="middle">Exam in ${examIn(plan)}</text>
      </svg>
      <figcaption class="ov-donut-readouts">${readout}</figcaption>
    </figure>`;
}
