import { clock } from '../state/clock.js';

// The prototype is built out for Chapter 1, so every shortcut here lands on a
// Chapter 1 screen, in the order a session reaches them.
const JUMPS = [
  ['setup', 'Exam setup'],
  ['study-time', 'Study time'],
  ['plan', 'Plan'],
  ['pace-intro', 'Pace intro'],
  ['flashcards', 'Flashcards'],
  ['flash-done', 'Flashcards done'],
  ['quiz', 'Quiz'],
  ['done-ahead', 'Done · time saved'],
  ['done-over', 'Done · time over'],
];

const TRIGGERS = [
  ['behind', 'Behind pace'],
  ['ahead', 'Ahead of pace'],
  ['stuck', 'Card keeps coming back'],
  ['plan-error', 'Plan build error'],
];

const STEPS = [
  [0.5, '+30 s'],
  [1, '+1 min'],
  [5, '+5 min'],
];

function buttons(action, attribute, entries) {
  return entries
    .map(([value, label]) => `<button class="ov-dbg-btn" data-ov="${action}" data-${attribute}="${value}">${label}</button>`)
    .join('');
}

export function debugPanel(ov) {
  const speeds = [1, 10, 30]
    .map(
      (value) =>
        `<button class="ov-dbg-btn${clock.speed === value ? ' is-on' : ''}" data-ov="dbg-speed" data-value="${value}">${value}×</button>`,
    )
    .join('');

  return `
    <section class="ov-dbg" role="dialog" aria-label="Debug panel">
      <header class="ov-dbg-head">
        <strong>Debug</strong>
        <button class="ov-dbg-btn" data-ov="dbg-close" aria-label="Close debug panel">✕</button>
      </header>

      <div class="ov-dbg-group">
        <span>Jump to</span>
        ${buttons('dbg-jump', 'target', JUMPS)}
      </div>

      <div class="ov-dbg-group">
        <span>Time</span>
        ${buttons('dbg-time', 'value', STEPS)}
        <i class="ov-dbg-gap" aria-hidden="true"></i>
        ${speeds}
      </div>

      <div class="ov-dbg-group">
        <span>Trigger</span>
        ${buttons('dbg-trigger', 'value', TRIGGERS)}
      </div>

      <div class="ov-dbg-group">
        <span>Session</span>
        <button class="ov-dbg-btn" data-ov="dbg-reset">Reset all state</button>
        <button class="ov-dbg-btn" data-ov="dbg-export">Export log (JSON)</button>
      </div>
      <p class="ov-dbg-note">Events logged: <b data-dbg-count>${ov.log.length}</b></p>
    </section>`;
}
