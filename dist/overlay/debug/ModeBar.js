// Always-visible prototype bar. Switching between the original reproduction
// and the sprint overlay has to be one tap during a session, so it does not
// live behind the hidden triple-tap.

const STAGE_LABEL = {
  idle: 'Browsing',
  chooser: 'Browsing',
  setup: 'Exam setup',
  building: 'Building plan',
  'plan-error': 'Plan failed',
  plan: 'Plan ready',
  study: 'Studying',
  'chapter-done': 'Chapter done',
  'sprint-done': 'Sprint done',
};

function stateLabel(ov) {
  if (ov.mode === 'original') return 'Base reproduction';
  if (ov.phase === 'study') {
    const stage = { flashcards: 'Flashcards', learn: 'Learn', review: 'Final review' }[ov.stage];
    const chapter = ov.plan && ov.stage !== 'review' ? ov.plan.chapters[ov.chapterIndex] : null;
    return chapter ? `${chapter.short} · ${stage}` : stage;
  }
  return STAGE_LABEL[ov.phase] || 'Browsing';
}

export function modeBar(ov) {
  return `
    <div class="ov-bar" role="toolbar" aria-label="Prototype controls">
      <div class="ov-bar-modes">
        <button class="ov-bar-pill${ov.mode === 'original' ? ' is-on' : ''}" data-ov="dbg-mode" data-value="original">Original</button>
        <button class="ov-bar-pill${ov.mode === 'sprint' ? ' is-on' : ''}" data-ov="dbg-mode" data-value="sprint">Sprint</button>
      </div>
      <span class="ov-bar-state">${stateLabel(ov)}</span>
      <div class="ov-bar-actions">
        <a class="ov-bar-pill" href="./design-system.html" target="_blank" rel="noopener">System</a>
        <button class="ov-bar-pill" data-ov="dbg-reset">Reset</button>
        <button class="ov-bar-pill${ov.debugOpen ? ' is-on' : ''}" data-ov="dbg-toggle">Debug</button>
      </div>
    </div>`;
}
