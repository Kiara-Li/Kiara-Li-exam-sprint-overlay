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

/** Reorder the existing slots immediately; reveal color only at the destination. */
export async function animateSegmentMove(track, fromIndex, toIndex, level) {
  if (!track) return;
  const segments = [...track.querySelectorAll('.sprint-pace-segment')];
  const source = segments[fromIndex];
  const destination = segments[toIndex];
  if (!source || !destination) return;
  if (source !== destination) destination.after(source);
  source.classList.remove('is-again', 'is-later');
  source.classList.add(level === 'later' ? 'is-later' : 'is-again');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  // One smooth pop; the overshoot comes from the curve instead of a hard
  // middle keyframe.
  await source.animate([
    { opacity: .4, transform: 'scaleX(.7)' },
    { opacity: 1, transform: 'scaleX(1)' },
  ], { duration: 340, easing: 'cubic-bezier(.34, 1.45, .64, 1)' }).finished;
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
      // Settle back with a slight overshoot rather than stopping dead.
      node.animate([{ transform: node.style.transform }, { transform: 'translate3d(0,0,0) rotate(0deg)' }], { duration: 420, easing: 'cubic-bezier(.34, 1.35, .64, 1)' }).finished.finally(() => { node.style.transform = ''; });
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

/**
 * Frames along a quadratic curve from the card to its bar segment. The control
 * point lets the card rise a little ahead of travelling sideways, the same
 * gathering motion as before. Dense sampling plus one global easing keeps
 * both the path and the speed continuous.
 */
function arcFrames(dx, dy, endScale, steps = 24) {
  const cx = dx * .26, cy = dy * .5;
  const turn = dx < 0 ? -1 : 1;
  const frames = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = 2 * (1 - t) * t * cx + t * t * dx;
    const y = 2 * (1 - t) * t * cy + t * t * dy;
    // Size eases down continuously; nothing is saved for the last frames.
    const scale = endScale + (1 - endScale) * Math.pow(1 - t, 1.25);
    const rotate = turn * 3 * Math.sin(Math.PI * t);
    // Fully visible for most of the trip, then dissolves into the segment.
    const opacity = t < .58 ? 1 : 1 - Math.pow((t - .58) / .42, 1.6);
    frames.push({
      transform: `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`,
      opacity: Math.max(0, opacity),
      offset: t,
    });
  }
  return frames;
}

/** Visually place the card at its next position on the pace bar. */
export async function flyIntoPace(card, bar, index, total, level, { onTravel = () => {} } = {}) {
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
  clone.style.border = `2px solid var(--sort-${level})`;
  clone.style.background = 'var(--color-white)';
  clone.style.borderRadius = 'var(--card-radius)';
  document.body.appendChild(clone);
  card.style.opacity = '0';
  const dx = targetX - (from.left + from.width / 2);
  const dy = targetY - (from.top + from.height / 2);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Shrink toward the segment's width, not its 6px height: matching the height
  // collapsed the card to a sliver in the last few frames, which read as a snap.
  const endScale = Math.max(.08, Math.min(.3, to.width / from.width));
  try {
    // The same gathering arc as before, drawn as one smooth quadratic curve
    // instead of two straight legs. The old three-keyframe version changed
    // direction and speed abruptly at its middle frame.
    await clone.animate(reduced ? [{ opacity: 0 }, { opacity: 0 }] : arcFrames(dx, dy, endScale), {
      duration: reduced ? 1 : 680,
      // Soft start, quick middle, long settle: a curved speed rather than a
      // constant one, so the card is thrown and then eases home.
      easing: 'cubic-bezier(.45, .05, .2, 1)',
      fill: 'forwards',
    }).finished;
    await onTravel();
  } finally {
    clone.remove();
    card.style.opacity = '';
  }
}
