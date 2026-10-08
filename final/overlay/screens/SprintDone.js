import { icon } from '../../base/components/icons.js';
import { formatDuration } from '../state/clock.js';

export function sprintDone(plan, stats) {
  const pieces = Array.from({ length: 18 }, (_, index) => {
    const color = `var(--sprint-chapter-${(index % 4) + 1})`;
    return `<i style="--piece:${index};--piece-color:${color}"></i>`;
  }).join('');

  return `
    <main class="screen ov-screen learn-complete-screen ov-sprint-done">
      <div class="ov-confetti" aria-hidden="true">${pieces}</div>
      <section class="learn-complete-content">
        <div class="trophy">${icon('trophy')}</div>
        <h1>You’re ready.</h1>
        <p>You covered ${stats.setsCovered} sets in ${formatDuration(stats.minutes)}.</p>
        <div class="ov-stats ov-stats-two">
          <div class="ov-stat is-done"><strong>Sets covered</strong><b>${stats.setsCovered}</b></div>
          <div class="ov-stat is-saved"><strong>Saved for later, then solved</strong><b>${stats.parkedSolved}</b></div>
        </div>
      </section>
      <div class="completion-actions">
        <button class="primary-button" data-ov="finish-sprint">Done</button>
      </div>
    </main>`;
}
