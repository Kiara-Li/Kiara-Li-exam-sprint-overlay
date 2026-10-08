import { course } from '../../base/data.js';
import { clock } from '../state/clock.js';

export function debugPanel(ov) {
  const speeds = [1, 10, 30]
    .map(
      (value) =>
        `<button class="ov-dbg-btn${clock.speed === value ? ' is-on' : ''}" data-ov="dbg-speed" data-value="${value}">${value}×</button>`,
    )
    .join('');

  const chapterCount = ov.plan ? ov.plan.chapters.length : course.sets.length;
  const chapterJumps = Array.from(
    { length: chapterCount },
    (_, index) => `<button class="ov-dbg-btn" data-ov="dbg-jump" data-target="chapter" data-index="${index}">Ch ${index + 1}</button>`,
  ).join('');

  return `
    <section class="ov-dbg" role="dialog" aria-label="Debug panel">
      <header class="ov-dbg-head">
        <strong>Debug</strong>
        <button class="ov-dbg-btn" data-ov="dbg-close" aria-label="Close debug panel">✕</button>
      </header>

      <div class="ov-dbg-group">
        <span>Mode</span>
        <button class="ov-dbg-btn${ov.mode === 'original' ? ' is-on' : ''}" data-ov="dbg-mode" data-value="original">original</button>
        <button class="ov-dbg-btn${ov.mode === 'sprint' ? ' is-on' : ''}" data-ov="dbg-mode" data-value="sprint">sprint</button>
      </div>

      <div class="ov-dbg-group">
        <span>Time</span>
        <button class="ov-dbg-btn" data-ov="dbg-time" data-value="1">+1 min</button>
        <button class="ov-dbg-btn" data-ov="dbg-time" data-value="5">+5 min</button>
        <button class="ov-dbg-btn" data-ov="dbg-time" data-value="15">+15 min</button>
        ${speeds}
      </div>

      <div class="ov-dbg-group">
        <span>Jump to</span>
        <button class="ov-dbg-btn" data-ov="dbg-jump" data-target="setup">Exam setup</button>
        <button class="ov-dbg-btn" data-ov="dbg-jump" data-target="plan">Plan</button>
        ${chapterJumps}
        <button class="ov-dbg-btn" data-ov="dbg-jump" data-target="done-ahead">ChapterDone (ahead)</button>
        <button class="ov-dbg-btn" data-ov="dbg-jump" data-target="done-over">ChapterDone (over)</button>
        <button class="ov-dbg-btn" data-ov="dbg-jump" data-target="final">Final review</button>
        <button class="ov-dbg-btn" data-ov="dbg-jump" data-target="sprint-done">SprintDone</button>
      </div>

      <div class="ov-dbg-group">
        <span>Trigger</span>
        <button class="ov-dbg-btn" data-ov="dbg-trigger" data-value="mild">Mild alert</button>
        <button class="ov-dbg-btn" data-ov="dbg-trigger" data-value="severe">Severe alert</button>
        <button class="ov-dbg-btn" data-ov="dbg-trigger" data-value="plan-error">Plan build error</button>
      </div>

      <div class="ov-dbg-group">
        <span>Session</span>
        <button class="ov-dbg-btn" data-ov="dbg-reset">Reset all state</button>
        <button class="ov-dbg-btn" data-ov="dbg-export">Export log (JSON)</button>
      </div>
      <p class="ov-dbg-note">Events logged: <b data-dbg-count>${ov.log.length}</b></p>
    </section>`;
}
