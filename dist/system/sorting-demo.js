// Standalone interaction study: no session storage or production controllers.
const ratings = [
  { key: 'repeat', label: 'Repeat', time: '≤5 min', detail: 'Back in ≤5 minutes' },
  { key: 'hard', label: 'Hard', time: '6 days', detail: 'Back in 6 days' },
  { key: 'okay', label: 'Okay', time: '2 weeks', detail: 'Back in 2 weeks' },
  { key: 'easy', label: 'Easy', time: '1 month', detail: 'Back in 1 month' },
];
const cards = [
  ['Impressionism', 'An art movement known for visible brushstrokes and changing light.'],
  ['Claude Monet', 'A French painter known for his Water Lilies series.'],
  ['Post-Impressionism', 'Artists who explored color, form, and expression beyond Impressionism.'],
  ['Vincent van Gogh', 'The artist who painted The Starry Night.'],
  ['Cubism', 'An approach that shows a subject from multiple viewpoints.'],
  ['Pablo Picasso', 'An artist who helped develop Cubism.'],
  ['Surrealism', 'An art movement that explores dreams and the unconscious.'],
  ['Salvador Dalí', 'The artist who painted The Persistence of Memory.'],
];

// Four horizontal destination regions, with a neutral pocket around the origin.
// Inner regions become available when the card moves down or sideways.
export function ratingAt(dx, dy, width) {
  if (Math.hypot(dx, dy) < width * .13) return null;
  if (dx < -width * .27) return 'repeat';
  if (dx > width * .27) return 'easy';
  if (dy < width * .10 && Math.abs(dx) < width * .14) return null;
  return dx <= width * .025 ? 'hard' : 'okay';
}

export function mountSortingDemo(host) {
  host.innerHTML = `<div class="sort-demo">
    <div class="sort-phone">
      <div class="sort-head">
        <button class="sort-icon" data-sort="undo" aria-label="Undo last sort" disabled>↶</button>
        <strong class="sort-count">0 / ${cards.length}</strong>
        <button class="sort-icon" data-sort="reset" aria-label="Restart sorting demo">↻</button>
      </div>
      <div class="sort-progress" role="progressbar" aria-label="Cards sorted" aria-valuemin="0" aria-valuemax="${cards.length}" aria-valuenow="0"><span></span></div>
      <div class="sort-stage">
        <div class="sort-under" aria-hidden="true"></div>
        <div class="sort-card" role="button" tabindex="0" aria-label="Flip flashcard">
          <div class="sort-term"></div>
          <div class="sort-feedback" aria-hidden="true"><span class="sort-symbol"></span><strong></strong><small></small></div>
        </div>
        <div class="sort-finish" hidden><strong>All sorted.</strong><button class="primary-button button-compact" data-sort="reset">Try again</button></div>
      </div>
      <div class="sort-ratings" role="group" aria-label="Sort card">
        ${ratings.map(r => `<button class="sort-rating" data-rating="${r.key}" aria-label="${r.label}, ${r.time}"><span>${r.label}</span><small>${r.time}</small></button>`).join('')}
      </div>
      <div class="sort-live" role="status" aria-live="polite"></div>
    </div>
    <p class="ds-meta sort-caption">Drag to sort · Tap to flip</p>
  </div>`;
  const card = host.querySelector('.sort-card');
  const stage = host.querySelector('.sort-stage');
  const term = host.querySelector('.sort-term');
  const buttons = [...host.querySelectorAll('[data-rating]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, back = false, busy = false, drag = null, zone = null;
  let x = 0, y = 0, frame = 0, version = 0, suppressClick = false;
  const history = [];
  const transform = (px = x, py = y) => {
    const angle = Math.max(-12, Math.min(12, px / stage.clientWidth * 18));
    return `translate3d(${px}px,${py}px,0) rotate(${angle}deg)`;
  };
  function setZone(next) {
    if (zone === next) return;
    zone = next;
    if (next) {
      const r = ratings.find(r => r.key === next);
      card.dataset.zone = next;
      host.querySelector('.sort-feedback strong').textContent = r.label;
      host.querySelector('.sort-feedback small').textContent = r.detail;
      host.querySelector('.sort-symbol').textContent = next === 'repeat' || next === 'hard' ? '⟳' : '✓';
    } else delete card.dataset.zone;
    buttons.forEach(b => b.classList.toggle('is-active', b.dataset.rating === next));
  }
  function render() {
    card.hidden = index === cards.length;
    host.querySelector('.sort-under').hidden = card.hidden;
    host.querySelector('.sort-finish').hidden = !card.hidden;
    card.style.display = card.hidden ? 'none' : '';
    if (!card.hidden) {
      term.textContent = cards[index][back ? 1 : 0];
      card.dataset.side = back ? 'back' : 'front';
      card.setAttribute('aria-label', `${term.textContent}. Flip flashcard.`);
    }
    host.querySelector('.sort-count').textContent = `${index} / ${cards.length}`;
    host.querySelector('.sort-progress').setAttribute('aria-valuenow', index);
    host.querySelector('.sort-progress span').style.width = `${index / cards.length * 100}%`;
    host.querySelector('[data-sort="undo"]').disabled = !history.length || busy;
    buttons.forEach(b => { b.disabled = busy || card.hidden; });
  }
  async function animate(frames, duration, easing) {
    const animation = card.animate(frames, { duration: reduced.matches ? 1 : duration, easing, fill: 'forwards' });
    try { await animation.finished; } catch { return false; }
    animation.cancel();
    return true;
  }
  function release() {
    if (drag && card.hasPointerCapture(drag.id)) card.releasePointerCapture(drag.id);
    drag = null;
    cancelAnimationFrame(frame);
  }
  async function returnHome() {
    const ticket = version;
    release();
    busy = true;
    setZone(null);
    render();
    const start = transform();
    await animate([{ transform: start }, { transform: 'translate3d(0,0,0) rotate(0deg)' }], 380, 'cubic-bezier(.18,.85,.26,1.16)');
    if (ticket !== version) return;
    x = y = 0;
    card.style.transform = transform();
    busy = false;
    render();
  }
  async function commit(key, fromButton = false) {
    if (busy || index === cards.length) return;
    const ticket = version;
    release();
    busy = true;
    setZone(key);
    render();
    const width = stage.clientWidth;
    const target = {
      repeat: [-width * .53, -26],
      hard: [-width * .15, 75],
      okay: [width * .16, 22],
      easy: [width * .53, 85],
    }[key];
    if (fromButton) {
      await animate([{ transform: transform() }, { transform: transform(...target) }], 240, 'cubic-bezier(.2,.7,.3,1)');
      if (ticket !== version) return;
      [x, y] = target;
      card.style.transform = transform();
    }
    const out = key === 'repeat' ? [-width * 1.6, y - 60] : key === 'easy' ? [width * 1.6, y + 160] : [x + (key === 'hard' ? -40 : 40), stage.clientHeight * 1.5];
    await animate([{ transform: transform(), opacity: 1 }, { transform: transform(...out), opacity: 0 }], 320, 'cubic-bezier(.32,0,.65,.35)');
    if (ticket !== version) return;
    history.push({ index, key });
    index++;
    back = false;
    x = y = 0;
    card.style.transform = transform();
    setZone(null);
    render();
    host.querySelector('.sort-live').textContent = `${ratings.find(r => r.key === key).label}. ${index} of ${cards.length} cards sorted.`;
    if (index < cards.length) await animate([{ transform: 'scale(.96)', opacity: .4 }, { transform: transform(), opacity: 1 }], 220, 'cubic-bezier(.2,.8,.2,1)');
    if (ticket !== version) return;
    busy = false;
    render();
    if (index === cards.length) host.querySelector('.sort-finish button').focus({ preventScroll: true });
  }
  card.addEventListener('pointerdown', event => {
    if (busy || drag || !event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
  });
  card.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; card.setPointerCapture(event.pointerId); }
    x = dx;
    y = dy;
    setZone(ratingAt(x, y, stage.clientWidth));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { card.style.transform = transform(); });
  });
  card.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved) { release(); return; }
    suppressClick = true;
    const chosen = zone;
    if (chosen) commit(chosen); else returnHome();
  });
  const cancelDrag = () => { if (drag) { suppressClick = true; returnHome(); } };
  card.addEventListener('pointercancel', cancelDrag);
  card.addEventListener('lostpointercapture', cancelDrag);
  addEventListener('blur', cancelDrag);
  addEventListener('resize', cancelDrag);
  card.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (!busy && !drag) { back = !back; render(); }
  });
  card.addEventListener('keydown', event => {
    if (event.key === 'Escape') { cancelDrag(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!busy) { back = !back; render(); }
    }
  });
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.rating) { commit(button.dataset.rating, true); return; }
    if (!button.dataset.sort) return;
    version++;
    release();
    card.getAnimations().forEach(a => a.cancel());
    if (button.dataset.sort === 'undo' && history.length) index = history.pop().index;
    else { index = 0; history.length = 0; }
    busy = back = suppressClick = false;
    x = y = 0;
    setZone(null);
    card.style.transform = transform();
    host.querySelector('.sort-live').textContent = button.dataset.sort === 'undo' ? 'Last sort undone.' : 'Demo restarted.';
    render();
  });
  render();
}
if (typeof document !== 'undefined') {
  const host = document.querySelector('#sorting-demo');
  if (host) mountSortingDemo(host);
}
