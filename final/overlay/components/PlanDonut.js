import { formatCompact, formatDuration } from '../state/clock.js';
import { totalAllotted } from '../state/sprintPlan.js';
import { chapterColor } from './PlanTimeline.js';

// Geometry in SVG user units. The viewBox is unitless, so these are
// proportions of the drawing, not page sizes.
const VIEW = 100;
const CENTRE = VIEW / 2;
const RADIUS = 38;
const THICKNESS = 12;
const GAP = 1.4;

/**
 * One ring, one arc per chapter, hover or tap an arc to read its budget.
 * Easier to compare at a glance than a thin horizontal bar.
 */
export function planDonut(plan) {
  const total = totalAllotted(plan) || 1;
  const circumference = 2 * Math.PI * RADIUS;
  const slices = [
    ...plan.chapters
      .filter((chapter) => chapter.status !== 'skipped')
      .map((chapter) => ({
        key: String(chapter.order),
        name: chapter.short,
        detail: chapter.title.split('·').slice(1).join('·').trim(),
        minutes: chapter.allotted,
        color: chapterColor(chapter.order),
        shaky: chapter.shaky,
      })),
    {
      key: 'final',
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
      const short = slice.key === 'final' ? 'FR' : slice.key === '' ? '' : `${Number(slice.key) + 1}`;
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

  return `
    <figure class="ov-donut" data-donut>
      <svg viewBox="0 0 ${VIEW} ${VIEW}" role="img" aria-label="Time split across the plan">
        <circle class="ov-donut-track" cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}" stroke-width="${THICKNESS}" />
        <g class="ov-donut-arcs">${arcs}</g>
        <g class="ov-donut-labels">${labels}</g>
        <text class="ov-donut-total" style="font-size:${Math.min(15, 76 / Math.max(1, formatCompact(total).length))}px" x="${CENTRE}" y="${CENTRE - 1}" text-anchor="middle">${formatCompact(total)}</text>
        <text class="ov-donut-total-note" x="${CENTRE}" y="${CENTRE + 10}" text-anchor="middle">until the exam</text>
      </svg>
      <figcaption class="ov-donut-readouts">${readout}</figcaption>
    </figure>`;
}
