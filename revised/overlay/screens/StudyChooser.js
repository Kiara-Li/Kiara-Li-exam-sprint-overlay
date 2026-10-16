import { icon } from '../../base/components/icons.js';
import { clockGlyph } from '../components/glyphs.js';
import { sheet } from '../components/ParkedSheet.js';

export function studyChooser() {
  return sheet({
    name: 'chooser',
    body: `
      <div class="ov-sheet-rows">
        <button class="ov-sheet-row" data-ov="study-all">
          <span class="ov-sheet-row-icon">${icon('cards')}</span>
          <span class="ov-sheet-row-copy"><strong>Study all</strong></span>
        </button>
        <button class="ov-sheet-row" data-ov="prep-exam">
          <span class="ov-sheet-row-icon">${clockGlyph('ov-glyph')}</span>
          <span class="ov-sheet-row-copy">
            <strong>Prep for an exam</strong>
            <small>Plan your time across every set</small>
          </span>
        </button>
      </div>`,
  });
}
