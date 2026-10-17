/** The three ways a set can be studied, in the words the screens use. */
export const MODES = [
  { key: 'normal', name: 'Normal' },
  { key: 'speed', name: 'Speed-up' },
  { key: 'last', name: 'Last pass' },
];

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
        <h1>One last look</h1>
        <p class="ov-last-count">${terms.length} ${terms.length === 1 ? 'card' : 'cards'}</p>
        <ol class="ov-last-list">${rows}</ol>
      </section>
      <div class="sticky-action ov-last-action">
        <button class="primary-button ov-full" data-ov="finish-last-pass">Done</button>
      </div>
    </main>`;
}
