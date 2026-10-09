import { formatRemaining } from '../state/clock.js';
import { parkedCount, remainingMs } from '../state/sprintPlan.js';
import { chapterColor, planPlayhead, planTimeline } from './PlanTimeline.js';

const STAGE_LABEL = {
  flashcards: 'Flashcards',
  learn: 'Learn',
  test: 'Test',
  review: 'Final review',
};

/** What the island is counting down right now: a chapter, or the final review. */
function currentUnit(ov) {
  const { plan, chapterIndex, stage } = ov;
  if (stage === 'review') {
    return {
      name: 'Final review',
      color: 'var(--sprint-final)',
      remaining: (plan.finalReview.allotted - plan.finalReview.used) * 60000,
      parked: 0,
      step: plan.chapters.filter((chapter) => chapter.status !== 'skipped').length + 1,
    };
  }
  const chapter = plan.chapters[chapterIndex];
  if (!chapter) return { name: '', color: 'var(--sprint-final)', remaining: 0, parked: 0, step: 1 };
  return {
    name: chapter.short,
    color: chapterColor(chapter.setIndex),
    remaining: remainingMs(chapter),
    parked: chapter.parked.length,
    step: chapter.order + 1,
  };
}

function head(unit, stageLabel) {
  return `
    <div class="ov-island-head">
      <span class="ov-island-dot" style="--dot-color:${unit.color}"></span>
      <span class="ov-island-title">${unit.name}</span>
      <span class="ov-island-stage">${stageLabel}</span>
      <span class="ov-island-time" data-island-time>${formatRemaining(unit.remaining)}</span>
      ${unit.parked ? `<span class="ov-island-badge" data-island-badge>${unit.parked}</span>` : ''}
    </div>`;
}

/**
 * Studying without a plan. The island stays, because its absence made the
 * whole feature look like it only existed on one screen.
 */
function unplanned(stageLabel) {
  return `
    <div class="ov-island-head">
      <span class="ov-island-dot" style="--dot-color:var(--island-text-muted)"></span>
      <span class="ov-island-title">No time plan</span>
      <span class="ov-island-stage">${stageLabel}</span>
      <button class="ov-island-chip is-primary" data-ov="plan-my-time">Plan my time</button>
    </div>
    <div class="ov-island-body"><div class="ov-island-inner"></div></div>`;
}

export function islandContent(ov, { planned = true, stage = ov.stage } = {}) {
  const stageLabel = STAGE_LABEL[stage] || '';
  if (!planned) return unplanned(stageLabel);

  const { plan, chapterIndex, island } = ov;
  const unit = currentUnit(ov);
  const allParked = parkedCount(plan);
  const steps = plan.chapters.filter((chapter) => chapter.status !== 'skipped').length + 1;
  const percent = Math.round(ov.stage === 'review' ? 100 : planPlayhead(plan, chapterIndex));

  if (island.state === 'alert' && island.alert) {
    const actions = island.alert.actions
      .map(
        (action, index) =>
          `<button class="ov-island-chip${index === 0 && island.alert.primaryFirst ? ' is-primary' : ''}" data-ov="alert-action" data-index="${index}">${action.label}</button>`,
      )
      .join('');
    return `
      <div class="ov-island-head">
        <span class="ov-island-dot" style="--dot-color:${unit.color}"></span>
        <span class="ov-island-message">${island.alert.message}</span>
      </div>
      <div class="ov-island-body"><div class="ov-island-inner">
        ${island.alert.detail ? `<p class="ov-island-detail">${island.alert.detail}</p>` : ''}
        <div class="ov-island-actions">${actions}</div>
      </div></div>`;
  }

  if (island.state === 'celebrate') {
    return `
      <div class="ov-island-head">
        <span class="ov-island-dot" style="--dot-color:var(--sprint-saved)"></span>
        <span class="ov-island-message">${island.message}</span>
      </div>
      <div class="ov-island-body"><div class="ov-island-inner"></div></div>`;
  }

  if (island.state === 'expanded') {
    return `
      ${head(unit, stageLabel)}
      <div class="ov-island-body"><div class="ov-island-inner">
        <p class="ov-island-progress">
          <span>Step ${unit.step} of ${steps}</span>
          <span>${percent}% through your plan</span>
        </p>
        ${planTimeline(plan, {
          mini: true,
          activeIndex: ov.stage === 'review' ? -1 : chapterIndex,
          playhead: percent,
        })}
        <div class="ov-island-actions">
          <button class="ov-island-chip" data-ov="open-parked">Saved for later (${allParked})</button>
          ${ov.stage === 'review' ? '' : '<button class="ov-island-chip" data-ov="add-time">+5 min</button>'}
        </div>
      </div></div>`;
  }

  return `
    ${head(unit, stageLabel)}
    <div class="ov-island-body"><div class="ov-island-inner"></div></div>`;
}

export function islandShell() {
  const node = document.createElement('div');
  node.className = 'ov-island-wrap';
  node.innerHTML =
    '<div class="ov-island" data-island data-state="compact" data-ov="island-toggle" role="status"></div>';
  return node;
}
