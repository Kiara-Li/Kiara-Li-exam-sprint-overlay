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
  'pace-intro': 'Your pace',
  study: 'Studying',
  'chapter-done': 'Chapter done',
  'sprint-done': 'Sprint done',
};

function stateLabel(ov) {
  if (ov.mode === 'original') return 'Base reproduction';
  if (ov.phase === 'study') {
    const stage = { flashcards: 'Flashcards', transition: 'Flashcards done', learn: 'Quiz', review: 'Final review' }[ov.stage];
    const chapter = ov.plan && ov.stage !== 'review' ? ov.plan.chapters[ov.chapterIndex] : null;
    return chapter ? `${chapter.short} · ${stage}` : stage;
  }
  return STAGE_LABEL[ov.phase] || 'Browsing';
}

export function modeBar(ov) {
  return `
    <div class="ov-bar" role="toolbar" aria-label="Prototype controls">
      <div class="ov-bar-modes">
        <a class="ov-bar-pill" href="../index.html?mode=original">Original</a>
        <a class="ov-bar-pill" href="../index.html?mode=sprint">2.1 test</a>
        ${ov.demo ? '<a class="ov-bar-pill" href="./index.html">Final</a><span class="ov-bar-pill is-on" aria-current="page">Demo</span>' : '<span class="ov-bar-pill is-on" aria-current="page">Final</span><a class="ov-bar-pill" href="./index.html?mode=demo">Demo</a>'}
      </div>
      <span class="ov-bar-state">${stateLabel(ov)}</span>
      <div class="ov-bar-actions">
        <a class="ov-bar-pill" href="./design-system.html" target="_blank" rel="noopener">System</a>
        <button class="ov-bar-pill" data-ov="dbg-reset">Reset</button>
        <button class="ov-bar-pill${ov.debugOpen ? ' is-on' : ''}" data-ov="dbg-toggle">Debug</button>
      </div>
    </div>`;
}
