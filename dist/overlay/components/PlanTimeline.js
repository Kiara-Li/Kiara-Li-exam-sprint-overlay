import { totalAllotted } from '../state/sprintPlan.js';

export function chapterColor(order) {
  return `var(--sprint-chapter-${(order % 4) + 1})`;
}

/**
 * One segment per chapter, width proportional to its budget, with a lighter
 * sub-band for the Flashcards portion. Final review closes the bar.
 */
export function planTimeline(plan, { mini = false, activeIndex = -1, playhead = null } = {}) {
  const total = totalAllotted(plan) || 1;
  const segments = plan.chapters
    .filter((chapter) => chapter.status !== 'skipped')
    .map((chapter) => {
      const share = (chapter.allotted / total) * 100;
      const band = Math.round(chapter.stages.flashcards * 100);
      const active = chapter.order === activeIndex ? ' is-active' : '';
      const done = chapter.status === 'done' ? ' is-done' : '';
      return `
        <span class="ov-timeline-seg${active}${done}" style="--seg-share:${share}%;--seg-color:${chapterColor(chapter.order)}" title="${chapter.short}">
          ${band ? `<i class="ov-timeline-band" style="--band-share:${band}%"></i>` : ''}
        </span>`;
    })
    .join('');

  const finalShare = (plan.finalReview.allotted / total) * 100;
  const head = playhead === null ? '' : `<i class="ov-timeline-playhead" style="--playhead:${Math.min(100, Math.max(0, playhead))}%"></i>`;

  return `
    <div class="ov-timeline${mini ? ' is-mini' : ''}" role="img" aria-label="Plan timeline">
      ${segments}
      <span class="ov-timeline-seg is-final" style="--seg-share:${finalShare}%;--seg-color:var(--sprint-final)"></span>
      ${head}
    </div>`;
}

/** Fraction of the whole plan that is behind the user right now. */
export function planPlayhead(plan, activeIndex) {
  const total = totalAllotted(plan) || 1;
  let passed = 0;
  plan.chapters.forEach((chapter, index) => {
    if (index < activeIndex) passed += chapter.allotted;
    if (index === activeIndex) passed += Math.min(chapter.used, chapter.allotted);
  });
  return (passed / total) * 100;
}
