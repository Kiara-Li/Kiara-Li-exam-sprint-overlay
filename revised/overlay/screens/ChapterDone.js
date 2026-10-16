import { icon } from '../../base/components/icons.js';

export function chapterDone(plan, chapterIndex) {
  const chapter = plan.chapters[chapterIndex];
  const result = chapter.result || { kind: 'even', amount: 0, target: null };
  const next = plan.chapters.find((entry, index) => index > chapterIndex && entry.status === 'upcoming');

  const moved = result.kind === 'saved' ? result.amount : result.kind === 'over' ? -result.amount : 0;
  const receiverNow = next ? next.allotted : plan.finalReview.allotted;
  const receiverBefore = receiverNow - (result.kind === 'saved' ? result.amount : 0);

  const headline =
    result.kind === 'saved'
      ? `<div class="ov-reallocation is-saved" data-token-source>
           <span class="ov-reallocation-label">Time saved</span>
           <strong class="ov-reallocation-value">+${result.amount} min</strong>
           <span class="ov-reallocation-note">Moving to ${result.target}</span>
         </div>`
      : result.kind === 'over'
        ? `<div class="ov-reallocation is-over" data-token-source>
             <span class="ov-reallocation-label">Time over</span>
             <strong class="ov-reallocation-value">−${result.amount} min</strong>
             <span class="ov-reallocation-note">Taken from ${result.target}</span>
           </div>`
        : `<div class="ov-reallocation" data-token-source>
             <span class="ov-reallocation-label">Right on time</span>
             <strong class="ov-reallocation-value">0 min</strong>
             <span class="ov-reallocation-note">Plan unchanged</span>
           </div>`;

  const upNext = next
    ? `<button class="up-next ov-up-next" disabled data-token-target>
         <span>${icon('cards')}</span>
         <span>
           <small>Up next</small>
           <strong>${next.short}</strong>
           <small class="ov-time-change"><b data-time-target data-from="${receiverBefore}" data-to="${receiverNow}">${receiverBefore}</b> min</small>
         </span>
         <span class="up-next-arrow">›</span>
       </button>`
    : `<button class="up-next ov-up-next" disabled data-token-target>
         <span>${icon('test')}</span>
         <span>
           <small>Up next</small>
           <strong>Final review</strong>
           <small class="ov-time-change"><b data-time-target data-from="${plan.finalReview.allotted}" data-to="${plan.finalReview.allotted}">${plan.finalReview.allotted}</b> min</small>
         </span>
         <span class="up-next-arrow">›</span>
       </button>`;

  return `
    <main class="screen ov-screen flash-complete-screen ov-chapter-done" data-moved="${moved}">
      <header class="app-header">
        <span class="header-spacer"></span>
        <div class="app-header-title">${chapter.total} / ${chapter.total}</div>
        <span class="header-spacer"></span>
      </header>
      <section class="flash-complete-content">
        <h1>${chapter.short} done!</h1>
        <p>${chapter.parked.length ? `${chapter.parked.length} saved for the final review` : 'Nice pace. Keep it going.'}</p>

        ${headline}

        <div class="ov-stats ov-stats-two">
          <div class="ov-stat is-left"><strong>Terms left</strong><b>0</b></div>
          <div class="ov-stat is-done"><strong>Completed</strong><b>${chapter.total}</b></div>
        </div>
        ${upNext}
        <button class="primary-button ov-full" data-ov="finish-sprint">Done</button>
      </section>
    </main>`;
}

/**
 * Flies a pill of minutes from the result card into the Up next card, then
 * ticks that card's number up. Called after the screen is in the DOM.
 */
export function playReallocation(root) {
  const screen = root.querySelector('.ov-chapter-done');
  if (!screen) return;
  const moved = Number(screen.dataset.moved);
  const source = screen.querySelector('[data-token-source]');
  const target = screen.querySelector('[data-token-target]');
  const number = screen.querySelector('[data-time-target]');
  if (!source || !target || !number) return;

  const from = Number(number.dataset.from);
  const to = Number(number.dataset.to);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!moved || from === to) {
    number.textContent = String(to);
    return;
  }

  if (reduced) {
    number.textContent = String(to);
    number.classList.add('is-ticked');
    return;
  }

  const a = source.getBoundingClientRect();
  const b = target.getBoundingClientRect();

  const token = document.createElement('span');
  token.className = `ov-fly-token ${moved > 0 ? 'is-saved' : 'is-over'}`;
  token.textContent = `${moved > 0 ? '+' : '−'}${Math.abs(moved)} min`;
  token.style.left = `${a.left + a.width / 2}px`;
  token.style.top = `${a.top + a.height / 2}px`;
  document.body.appendChild(token);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);

  const flight = token.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 28}px)) scale(1)`, opacity: 1, offset: 0.62 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0 },
    ],
    { duration: 900, easing: 'cubic-bezier(0.42, 0, 0.3, 1)', fill: 'forwards' },
  );

  flight.onfinish = () => {
    token.remove();
    target.classList.add('is-receiving');
    number.classList.add('is-ticked');
    const steps = Math.min(Math.abs(to - from), 18);
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      const value = Math.round(from + ((to - from) * step) / steps);
      number.textContent = String(value);
      if (step >= steps) {
        window.clearInterval(timer);
        number.textContent = String(to);
      }
    }, 34);
    window.setTimeout(() => target.classList.remove('is-receiving'), 600);
  };
}
