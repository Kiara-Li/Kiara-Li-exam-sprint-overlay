export const LEVELS = [
  { key: 'again', label: "Don't know", next: 'Back in a moment' },
  { key: 'later', label: 'Kind of', next: 'Later in this set' },
  { key: 'done', label: 'Got it', next: 'Done for now' },
];

export function sortStrip(levels, { hint = false, details = true } = {}) {
  const right = levels.includes('done') ? 'Got it' : 'Kind of';
  return `<div class="sprint-sort-controls">
    ${hint ? `<p class="sprint-first-hint">Sort by how well you know it. Swipe left for Don't know, right for ${right}.</p>` : ''}
    <div class="sprint-sort-strip${levels.length === 2 ? ' is-two' : ''}" role="group" aria-label="Sort this item">
      ${levels.map(key => {
        const level = LEVELS.find(item => item.key === key);
        return `<button type="button" class="sprint-sort-option" data-pace-sort="${key}" data-level="${key}" aria-label="${level.label}. ${level.next}">${level.label}</button>`;
      }).join('')}
    </div>
    ${details ? `<div class="sprint-sort-next" aria-hidden="true">
      ${levels.map(key => `<span>${LEVELS.find(item => item.key === key).next}</span>`).join('')}
    </div>` : ''}
  </div>`;
}

export function sortDestination(position, total, level) {
  if (level === 'again') return Math.min(position + 2, total - 1);
  if (level === 'later') return total - 1;
  return position;
}

export function paceMarkup({ completed, items, statuses, target, toast = '', decision = false, intro = false }) {
  const total = items.length;
  const safeTotal = Math.max(1, total);
  const targetPercent = Math.max(0, Math.min(100, target * 100));
  const youPercent = Math.max(0, Math.min(100, completed / safeTotal * 100));
  return `<div class="sprint-pace-shell">
    <div class="sprint-pace-track" role="progressbar" aria-label="Study pace" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}" style="--pace-target:${targetPercent}%;--pace-you:${youPercent}%">
      ${items.map((item, index) => {
        const termIndex = typeof item === 'number' ? item : item.termIndex;
        const status = statuses.get(termIndex);
        return `<span class="sprint-pace-segment${index < completed ? ' is-complete' : status === 'again' ? ' is-again' : status === 'later' ? ' is-later' : ''}" data-term="${termIndex}" aria-hidden="true"></span>`;
      }).join('')}
      <span class="sprint-pace-target" aria-hidden="true"></span>
      <span class="sprint-pace-you" aria-hidden="true"></span>
      <span class="sprint-pace-pop" aria-hidden="true"></span>
    </div>
    ${intro ? '<div class="sprint-pace-intro" role="note">The light-blue ball tracks your time goal.</div>' : ''}
    <div class="sprint-pace-toast${toast ? ' is-fading' + (toast.kind === 'good' ? ' is-good' : '') : ''}" role="status">${toast ? toast.text : ''}</div>
    ${decision ? `<div class="sprint-pace-decision" role="group" aria-label="Repeated item">
      <p>This one keeps coming back. Move it later?</p>
      <div><button type="button" data-pace-decision="later">Move it later</button><button type="button" data-pace-decision="again">Keep it close</button></div>
    </div>` : ''}
  </div>`;
}

/** Move the existing colored slot; each passed slot fills the space behind it. */
export async function animateSegmentMove(track, fromIndex, toIndex, level) {
  const segments = [...track.querySelectorAll('.sprint-pace-segment')];
  const source = segments[fromIndex];
  const destination = segments[toIndex];
  if (!source || !destination) return;
  source.classList.remove('is-again', 'is-later');
  source.classList.add(level === 'later' ? 'is-later' : 'is-again');
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fromIndex === toIndex || reduced) return;
  await new Promise(resolve => window.setTimeout(resolve, 180));
  const positions = segments.map(segment => segment.getBoundingClientRect().left);
  source.style.zIndex = '3';
  const animations = [source.animate([
    { transform: 'translateX(0)' },
    { transform: `translateX(${positions[toIndex] - positions[fromIndex]}px)` },
  ], { duration: 460, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' })];
  for (let index = fromIndex + 1; index <= toIndex; index += 1) {
    animations.push(segments[index].animate([
      { transform: 'translateX(0)' },
      { transform: `translateX(${positions[index - 1] - positions[index]}px)` },
    ], { duration: 460, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' }));
  }
  await Promise.allSettled(animations.map(animation => animation.finished));
}

/** A reversible horizontal gesture on the current card or answered question. */
export function bindSortGesture(node, { allowed, onChoose, onInteract, onPreview }) {
  const abort = new AbortController();
  const listen = (type, handler, options = {}) => node.addEventListener(type, handler, { ...options, signal: abort.signal });
  let start = null;
  let moved = false;
  let suppressClick = false;
  let busy = false;
  let frame = 0;
  function reset() {
    const pointer = start?.id;
    start = null;
    cancelAnimationFrame(frame);
    if (pointer !== undefined && node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
  }
  function preview(level, dx = 0) {
    if (level) node.dataset.sortPreview = level;
    else delete node.dataset.sortPreview;
    onPreview(level);
    frame = requestAnimationFrame(() => {
      node.style.transform = level ? `translate3d(${dx}px,0,0) rotate(${Math.max(-8, Math.min(8, dx / 18))}deg)` : '';
    });
  }
  async function choose(level, via) {
    if (busy || !allowed.includes(level)) return;
    busy = true;
    reset();
    node.querySelectorAll('[data-pace-sort]').forEach(button => { button.disabled = true; });
    await onChoose(level, via);
    busy = false;
  }
  listen('pointerdown', event => {
    if (busy || start || !event.isPrimary || event.button !== 0) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    moved = false;
    suppressClick = false;
    onInteract();
  });
  listen('pointermove', event => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!moved && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2)) return;
    if (!moved) { moved = true; node.setPointerCapture(event.pointerId); }
    const threshold = Math.max(45, node.clientWidth * .17);
    const level = dx < -threshold ? 'again' : dx > threshold ? (allowed.includes('done') ? 'done' : 'later') : null;
    cancelAnimationFrame(frame);
    preview(level, Math.max(-node.clientWidth * .48, Math.min(node.clientWidth * .48, dx * .48)));
  });
  listen('pointerup', event => {
    if (!start || event.pointerId !== start.id) return;
    if (!moved) { reset(); return; }
    suppressClick = true;
    const level = node.dataset.sortPreview;
    reset();
    if (level) choose(level, 'swipe');
    else {
      delete node.dataset.sortPreview;
      node.animate([{ transform: node.style.transform }, { transform: 'none' }], { duration: 240, easing: 'ease-out' }).finished.finally(() => { node.style.transform = ''; });
      onPreview(null);
    }
  });
  listen('pointercancel', () => { reset(); delete node.dataset.sortPreview; node.style.transform = ''; onPreview(null); });
  listen('lostpointercapture', () => { if (start) reset(); });
  listen('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }, { capture: true });
  return { choose, dispose() { abort.abort(); reset(); cancelAnimationFrame(frame); } };
}

/** Visually place the card at its next position on the pace bar. */
export async function flyIntoPace(card, bar, index, total, level, { flip = false, onTravel = () => {} } = {}) {
  if (!card || !bar || level === 'done') return;
  const from = card.getBoundingClientRect();
  const to = bar.querySelectorAll('.sprint-pace-segment')[index]?.getBoundingClientRect() || bar.getBoundingClientRect();
  const targetX = to.left + to.width / 2;
  const targetY = to.top + to.height / 2;
  const clone = card.cloneNode(true);
  clone.className = 'sprint-flying-card';
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  clone.style.left = `${from.left}px`;
  clone.style.top = `${from.top}px`;
  clone.style.width = `${from.width}px`;
  clone.style.height = `${from.height}px`;
  clone.style.border = `3px solid var(--sort-${level})`;
  clone.style.background = 'var(--color-white)';
  clone.style.borderRadius = 'var(--card-radius)';
  if (flip) {
    clone.replaceChildren();
    clone.classList.add('is-flipping');
    const flipper = document.createElement('div');
    flipper.className = 'sprint-sort-flipper';
    const front = card.cloneNode(true);
    front.classList.add('sprint-sort-front');
    const back = document.createElement('div');
    back.className = 'sprint-sort-back';
    back.style.background = `var(--pace-${level})`;
    back.style.color = level === 'later' ? 'var(--color-white)' : 'var(--text-primary)';
    back.textContent = LEVELS.find(item => item.key === level).label;
    flipper.append(front, back);
    clone.append(flipper);
  }
  document.body.appendChild(clone);
  card.style.opacity = '0';
  const dx = targetX - (from.left + from.width / 2);
  const dy = targetY - (from.top + from.height / 2);
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 350;
  try {
    if (flip) await clone.firstElementChild.animate([
      { transform: 'rotateY(0deg)' },
      { transform: 'rotateY(-180deg)' },
    ], { duration: duration === 1 ? 1 : 320, easing: 'ease-in-out', fill: 'forwards' }).finished;
    await Promise.all([Promise.resolve(onTravel()), clone.animate([
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
      { transform: `translate3d(${dx}px,${dy}px,0) scale(${to.width / from.width},${to.height / from.height})`, opacity: 1 },
    ], { duration, easing: 'cubic-bezier(.35,.05,.7,1)', fill: 'forwards' }).finished]);
  } finally {
    clone.remove();
    card.style.opacity = '';
  }
}
