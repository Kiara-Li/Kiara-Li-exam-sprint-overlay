import { icon } from '../../base/components/icons.js';
import { formatClockTime, formatDuration } from '../state/clock.js';
import { totalAllotted } from '../state/sprintPlan.js';
import { planDonut } from '../components/PlanDonut.js';
import { actionButton } from '../../system/components.js';

export function planBuilding(titles) {
  const lines = titles
    .map(
      (title, index) =>
        `<span class="ov-build-line" style="--stagger:calc(var(--sprint-stagger) * ${index})">${title}</span>`,
    )
    .join('');
  return `
    <main class="screen ov-screen ov-building-screen">
      <section class="ov-building">
        <div class="ov-build-stack">${lines}</div>
        <div class="ov-build-bar"></div>
        <p class="ov-label">Building your plan…</p>
      </section>
    </main>`;
}

export function planError() {
  return `
    <main class="screen ov-screen ov-building-screen">
      <section class="ov-building">
        <h1 class="ov-error-title">Couldn’t build your plan.</h1>
        ${actionButton({ label: 'Try again', action: 'retry-plan' })}
      </section>
    </main>`;
}

export function planReady(plan) {
  const stages = plan.chapters
    .filter((chapter) => chapter.status !== 'skipped')
    .map(
      (chapter) => `
        <div class="mode-row decorative-mode ov-plan-row">
          <span class="mode-icon">${icon(chapter.stages.flashcards ? 'cards' : 'learn')}</span>
          <span class="ov-plan-name">${chapter.short}${chapter.shaky ? '<em class="ov-tag">Shaky</em>' : ''}<small>${
            chapter.stages.flashcards
              ? `Flashcards ${Math.round(chapter.allotted * chapter.stages.flashcards)} min · Learn ${Math.round(chapter.allotted * chapter.stages.learn)} min`
              : `Learn ${chapter.allotted} min`
          }</small></span>
          <span class="ov-plan-time">${chapter.allotted} min</span>
        </div>`,
    )
    .join('');

  return `
    <main class="screen ov-screen ov-plan-screen">
      <header class="app-header">
        <button class="icon-button" data-ov="back-to-setup" aria-label="Back">${icon('back')}</button>
        <div class="app-header-title"></div>
        <span class="header-spacer"></span>
      </header>
      <section class="ov-plan-content">
        <h1>Your plan</h1>
        <p class="ov-plan-meta">${plan.chapters.length} sets · ${formatDuration(totalAllotted(plan))} · Exam at ${formatClockTime(plan.examAt)}</p>
        ${plan.tight ? '<p class="ov-banner">That’s tight for ' + plan.chapters.length + ' sets. Here’s the leanest plan.</p>' : ''}

        ${planDonut(plan)}

        <h2 class="ov-section-title">How each set breaks down</h2>
        <div class="mode-list ov-plan-list">
          ${stages}
          <div class="mode-row decorative-mode ov-plan-row is-final">
            <span class="mode-icon">${icon('test')}</span>
            <span class="ov-plan-name">Final review<small>Everything you missed or saved for later</small></span>
            <span class="ov-plan-time">${plan.finalReview.allotted} min</span>
          </div>
        </div>
        <p class="ov-label ov-plan-note">Your plan adjusts as you go.</p>
      </section>
      <div class="sticky-action ov-plan-actions">
        ${actionButton({ label: 'Start', action: 'start-sprint' })}
        ${actionButton({ label: 'Adjust times', variant: 'text', action: 'open-adjust' })}
      </div>
    </main>`;
}
