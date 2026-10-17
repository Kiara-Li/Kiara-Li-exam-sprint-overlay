import { noticeList } from '../components/Notice.js';

/** The three ways a set can be studied, in the words the screens use. */
export const MODES = [
  { key: 'normal', name: 'Normal' },
  { key: 'speed', name: 'Speed-up' },
  { key: 'last', name: 'Last pass' },
];

const SPEED_CHANGES = {
  flashcards: ['No flipping', 'Just Don’t know or Got it', 'Skips cards you know'],
  learn: ['Two choices', 'Misses go to the back', 'Skips cards you got'],
};

/** What Speed-up changes, for the stage the user is in. */
export function speedOfferBody(stage) {
  return noticeList(SPEED_CHANGES[stage] || SPEED_CHANGES.flashcards);
}

/** Time is up: what is left, on one page, to read once. */
export function lastPass(set, terms) {
  const rows = terms
    .map((term) => {
      const [front, back] = set.terms[term];
      return `<li class="ov-last-card"><strong>${front}</strong><span>${back}</span></li>`;
    })
    .join('');
  return `
    <main class="screen ov-screen ov-last-pass">
      <header class="app-header">
        <span class="header-spacer"></span>
        <div class="app-header-title"><span class="ov-mode-tag is-last">Last pass</span></div>
        <span class="header-spacer"></span>
      </header>
      <section class="ov-last-content">
        <h1>What’s left</h1>
        <p class="ov-last-count">${terms.length} ${terms.length === 1 ? 'card' : 'cards'} · read each one once</p>
        <ol class="ov-last-list">${rows}</ol>
      </section>
      <div class="sticky-action ov-last-action">
        <button class="primary-button ov-full" data-ov="finish-last-pass">I’ve read these</button>
      </div>
    </main>`;
}
