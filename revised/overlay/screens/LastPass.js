import { boltGlyph } from '../components/glyphs.js';

/** The three ways a set can be studied, in the words the screens use. */
export const MODES = [
  { key: 'normal', name: 'Normal', line: 'Flip, sort and quiz as usual.' },
  { key: 'speed', name: 'Speed-up', line: 'Both sides at once, two choices, and cards you know are skipped.' },
  { key: 'last', name: 'Last pass', line: 'Everything left on one page, saved for your final review.' },
];

const SPEED_CHANGES = {
  flashcards: ['Both sides show at once, no flipping', 'Just Don’t know or Got it', 'Cards you already know are skipped'],
  learn: ['Two choices instead of four', 'Wrong answers go to the back by themselves', 'Cards you got in Flashcards are skipped'],
};

export function modeSheetBody(text) {
  return `<p class="ov-mode-copy">${text}</p>`;
}

/** What Speed-up changes, for the stage the user is in. */
export function speedOfferBody(stage) {
  const changes = SPEED_CHANGES[stage] || SPEED_CHANGES.flashcards;
  return `<ul class="ov-mode-changes">${changes.map((change) => `<li><span class="ov-mode-bolt">${boltGlyph()}</span>${change}</li>`).join('')}</ul>`;
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
