import { icon } from '../../base/components/icons.js';
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
      (chapter) => {
        const minutes = Math.round(chapter.allotted * chapter.stages.flashcards);
        return `<div class="ov-split-card" data-split-card="${chapter.order}">
          <div class="ov-split-heading"><strong>${chapter.short}</strong>${chapter.shaky ? '<em class="ov-tag">Shaky</em>' : ''}<span>${chapter.allotted} min</span></div>
          <div class="ov-split-labels"><span>Flashcards <b data-flash-minutes>${minutes} min</b></span><span>Quiz <b data-quiz-minutes>${chapter.allotted - minutes} min</b></span></div>
          <input class="ov-split-slider" type="range" min="0" max="90" step="1" value="${Math.round(chapter.stages.flashcards * 100)}" style="--split:${chapter.stages.flashcards * 100}%" data-stage-split="${chapter.order}" aria-label="${chapter.short}: time for flashcards" aria-valuetext="${minutes} minutes flashcards, ${chapter.allotted - minutes} minutes quiz">
        </div>`;
      },
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
      </section>
      <div class="sticky-action ov-plan-actions">
        ${actionButton({ label: 'Start', action: 'start-sprint' })}
        ${actionButton({ label: 'Adjust times', variant: 'text', action: 'open-adjust' })}
      </div>
    </main>`;
}

export function paceIntro() {
  const completionSteps = [18, 30, 40, 50, 60, 70, 80, 90];
  return `<main class="screen ov-screen ov-pace-intro">
    <style>${completionSteps.map((at, index) => `@keyframes ov-demo-fill-${index} { 0%, ${at - .1}% { background: var(--color-border-strong); } ${at}%, 99.9% { background: var(--color-primary); } }`).join('')}</style>
    <header class="app-header"><button class="icon-button" data-ov="intro-back" aria-label="Back">${icon('back')}</button><div></div><span></span></header>
    <section class="ov-intro-content">
      <h1>Catch up with the blue ball.</h1>
      <div class="ov-pace-demo" role="img" aria-label="The blue ball moves steadily with time. Your dark marker moves one step each time you finish a term.">
        <div class="ov-demo-track">${completionSteps.map((_, i) => `<span style="animation-name:ov-demo-fill-${i}"></span>`).join('')}</div>
        <span class="ov-demo-ball"></span><span class="ov-demo-you"></span>
      </div>
      <div class="ov-demo-labels"><span><i class="ov-ball-key"></i>Time goal</span><span><i class="ov-you-key"></i>You</span></div>
      <p>It moves with your planned pace. Finish a card or question to move your marker forward.</p>
      <p class="ov-intro-note">Keep up with the ball and you’re on pace.</p>
    </section>
    <div class="sticky-action"><button class="primary-button ov-full" data-ov="begin-study">Let’s go</button></div>
  </main>`;
}
