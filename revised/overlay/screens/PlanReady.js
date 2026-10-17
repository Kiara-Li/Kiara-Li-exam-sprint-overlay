import { boltGlyph } from '../components/glyphs.js';
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

/** One chapter's Flashcards / Quiz split, with its slider. */
export function splitCard(chapter) {
  const minutes = Math.round(chapter.allotted * chapter.stages.flashcards);
  return `<div class="ov-split-card" data-split-card="${chapter.order}">
          <div class="ov-split-heading"><strong>${chapter.short}</strong>${chapter.shaky ? '<em class="ov-tag">Shaky</em>' : ''}<span>${chapter.allotted} min</span></div>
          <div class="ov-split-labels"><span>Flashcards <b data-flash-minutes>${minutes} min</b></span><span>Quiz <b data-quiz-minutes>${chapter.allotted - minutes} min</b></span></div>
          <input class="ov-split-slider" type="range" min="0" max="90" step="1" value="${Math.round(chapter.stages.flashcards * 100)}" style="--split:${chapter.stages.flashcards * 100}%" data-stage-split="${chapter.order}" aria-label="${chapter.short}: time for flashcards" aria-valuetext="${minutes} minutes flashcards, ${chapter.allotted - minutes} minutes quiz">
        </div>`;
}

export function planReady(plan) {
  const stages = plan.chapters
    .filter((chapter) => chapter.status !== 'skipped')
    .map(
      (chapter) => splitCard(chapter),
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

/**
 * Before studying: one picture, one line, one button, the way Duolingo
 * introduces a feature. The picture is the Speed-up card itself; the line
 * says exactly what to tap.
 */
export function paceIntro() {
  return `<main class="screen ov-screen ov-pace-intro">
    <header class="app-header"><button class="icon-button" data-ov="intro-back" aria-label="Back">${icon('back')}</button><div></div><span></span></header>
    <section class="ov-intro-content">
      <div class="ov-intro-art" aria-hidden="true">
        <span class="ov-intro-card is-back"></span>
        <span class="ov-intro-card is-mid"></span>
        <span class="ov-intro-card is-front"><i class="is-term"></i><i></i><i class="is-short"></i></span>
        <span class="ov-intro-bolt">${boltGlyph()}</span>
      </div>
      <h1>Short on time?<br>We’ve got you.</h1>
      <p class="ov-intro-line">If you fall behind, tap <span class="sprint-mode-pill is-on ov-intro-pill">${boltGlyph()}Speed up</span></p>
    </section>
    <div class="sticky-action"><button class="primary-button ov-full" data-ov="begin-study">Let’s go</button></div>
  </main>`;
}
