import { icon } from '../../base/components/icons.js';

// Quizlet's own accent colours, so the burst looks like part of the app.
const CONFETTI = [
  'var(--color-primary)',
  'var(--color-cyan)',
  'var(--color-warning)',
  'var(--color-rating-purple)',
  'var(--color-success)',
];
const PIECES = 16;

function burst() {
  return Array.from({ length: PIECES }, (_, i) => {
    // Evenly spread with a little jitter, and three rings of distance, so the
    // burst reads as a pop rather than a perfect circle.
    const angle = ((i / PIECES) * 360 + (i % 2 ? 9 : -7)) * (Math.PI / 180);
    const distance = 72 + (i % 3) * 18;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const shape = i % 3 === 0 ? 'is-dot' : 'is-strip';
    return `<i class="ov-fd-piece ${shape}" style="--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--spin:${(i * 53) % 360}deg;--tint:${CONFETTI[i % CONFETTI.length]};--wait:${(i % 4) * 30}ms"></i>`;
  }).join('');
}

/**
 * End of the Flashcards pass. The two counts use the same colours as the sort
 * buttons the user just pressed: "Got it" in the done blue, the ones coming
 * back in the "Don't know" orange.
 */
export function flashDone({ got, practice, chapter = 'Chapter 1' }) {
  return `
    <div class="ov-fd">
      <div class="ov-fd-hero">
        <div class="ov-fd-burst" aria-hidden="true">
          <span class="ov-fd-wave"></span>
          ${burst()}
          <span class="ov-fd-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M6.2 12.6l3.9 3.9 7.7-8.6" /></svg>
          </span>
        </div>
        <h1 class="ov-fd-title">Flashcards done!</h1>
        <div class="ov-fd-stats">
          <div class="ov-fd-stat is-got"><b data-count-to="${got}">${got}</b><span>Got it</span></div>
          <div class="ov-fd-stat is-practice"><b data-count-to="${practice}">${practice}</b><span>To practice</span></div>
        </div>
      </div>
      <button type="button" class="ov-fd-next" data-ov="go-learn">
        <span class="ov-fd-next-icon">${icon('learn')}</span>
        <span class="ov-fd-next-copy"><small>Up next</small><strong>Practice · ${chapter}</strong></span>
        <span class="ov-fd-next-arrow" aria-hidden="true">›</span>
      </button>
    </div>`;
}

/** Counts each number up from zero once the cards have landed. */
export function playFlashDone(root) {
  const host = root?.querySelector('.ov-fd');
  if (!host || host.dataset.played) return;
  host.dataset.played = 'true';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  host.querySelectorAll('[data-count-to]').forEach((node, index) => {
    const to = Number(node.dataset.countTo);
    if (!to) return;
    node.textContent = '0';
    const start = performance.now() + 560 + index * 90;
    const length = 520;
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / length));
      // Ease out, so the last numbers tick in slowly like they are settling.
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = String(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
