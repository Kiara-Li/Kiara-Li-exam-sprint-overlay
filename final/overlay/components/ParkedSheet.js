import { course } from '../../base/data.js';
import { saveGlyph } from './glyphs.js';

export function sheet({ title = '', body = '', footer = '', name = '' }) {
  return `
    <div class="ov-scrim" data-ov="dismiss-sheet"></div>
    <section class="ov-sheet" data-sheet="${name}" role="dialog" aria-label="${title || name}">
      <span class="ov-sheet-grabber" aria-hidden="true"></span>
      ${title ? `<h2 class="ov-sheet-title">${title}</h2>` : ''}
      ${body}
      ${footer ? `<div class="ov-sheet-footer">${footer}</div>` : ''}
    </section>`;
}

export function parkedSheet(plan, { inReview = false } = {}) {
  const rows = plan.chapters
    .flatMap((chapter) =>
      chapter.parked.map((termIndex) => {
        const [term, definition] = course.sets[chapter.setIndex].terms[termIndex];
        return `
          <button class="ov-sheet-row" data-ov="unpark" data-chapter="${chapter.order}" data-term="${termIndex}">
            <span class="ov-sheet-row-icon">${saveGlyph('ov-glyph-sm')}</span>
            <span class="ov-sheet-row-copy">
              <strong>${definition}</strong>
              <small>${chapter.short} · ${term}</small>
            </span>
            <span class="ov-sheet-row-action">${inReview ? 'Remove' : 'Do now'}</span>
          </button>`;
      }),
    )
    .join('');

  const empty = `
    <p class="ov-sheet-empty">Nothing saved yet. Swipe a question up, or tap <strong>Save for later</strong>, to park it here.</p>`;

  const count = plan.chapters.reduce((sum, chapter) => sum + chapter.parked.length, 0);

  const footer = !count
    ? ''
    : inReview
      ? '<p class="ov-sheet-note">These are already in your final review.</p>'
      : `<button class="primary-button ov-full" data-ov="work-parked">Work on all ${count} now · 5 min</button>`;

  return sheet({
    name: 'parked',
    title: `Saved for later (${count})`,
    body: `<div class="ov-sheet-rows">${rows || empty}</div>`,
    footer,
  });
}

export function adjustSheet(plan) {
  const rows = plan.chapters
    .map(
      (chapter) => `
        <div class="ov-adjust-row">
          <span class="ov-adjust-name">${chapter.short}${chapter.shaky ? '<em class="ov-tag">Shaky</em>' : ''}</span>
          <span class="ov-stepper">
            <button data-ov="adjust" data-chapter="${chapter.order}" data-delta="-5" aria-label="Five minutes less">−5</button>
            <b data-adjust-minutes="${chapter.order}">${chapter.allotted} min</b>
            <button data-ov="adjust" data-chapter="${chapter.order}" data-delta="5" aria-label="Five minutes more">+5</button>
          </span>
        </div>`,
    )
    .join('');

  return sheet({
    name: 'adjust',
    title: 'Adjust times',
    body: `<div class="ov-adjust">${rows}
      <div class="ov-adjust-row is-final"><span class="ov-adjust-name">Final review</span><b data-adjust-final>${plan.finalReview.allotted} min</b></div>
    </div>`,
    footer: '<button class="primary-button ov-full" data-ov="dismiss-sheet">Done</button>',
  });
}
