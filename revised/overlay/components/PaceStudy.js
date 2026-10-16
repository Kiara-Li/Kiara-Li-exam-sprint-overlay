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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The face the user is looking at, as a flat copy that can sit in a flipper. */
function visibleFace(card) {
  if (card.classList.contains('flashcard')) {
    const face = card.querySelector(card.classList.contains('is-flipped') ? '.flashcard-back' : '.flashcard-front');
    if (face) {
      const copy = face.cloneNode(true);
      // Keep the face's own look; only undo its 3D placement in the real card.
      copy.style.cssText += ';position:absolute;inset:0;margin:0;transform:none;backface-visibility:hidden;-webkit-backface-visibility:hidden;';
      return copy;
    }
  }
  const copy = card.cloneNode(true);
  copy.classList.add('sprint-sort-front');
  return copy;
}

/**
 * Frames for the turned card on its way into the bar. It follows the same
 * gathering arc as before and shrinks as a card for most of the trip, then in
 * the last stretch flattens into the segment's own shape, so a solid orange
 * card becomes the orange segment rather than vanishing near it.
 */
function landFrames(dx, dy, sx, sy, steps = 28) {
  const cx = dx * .26, cy = dy * .5;
  const flattenFrom = .72;
  const frames = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = 2 * (1 - t) * t * cx + t * t * dx;
    const y = 2 * (1 - t) * t * cy + t * t * dy;
    const asCard = sx + (1 - sx) * Math.pow(1 - Math.min(1, t / flattenFrom), 1.35);
    const f = t <= flattenFrom ? 0 : (t - flattenFrom) / (1 - flattenFrom);
    const flatten = 1 - Math.pow(1 - f, 2);
    const scaleY = asCard + (sy - asCard) * flatten;
    const opacity = t < .9 ? 1 : 1 - (t - .9) / .1;
    frames.push({
      transform: `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${asCard.toFixed(4)},${scaleY.toFixed(4)})`,
      opacity: Math.max(0, opacity),
      offset: t,
    });
  }
  return frames;
}

/**
 * Visually place the card at its next position on the pace bar. The card
 * turns over to a face in its sort colour, then tucks into the bar, so its
 * colour and the segment's are the same thing arriving.
 */
export async function flyIntoPace(card, bar, index, total, level, { flip = true, onTravel = () => {} } = {}) {
  if (!card || !bar || level === 'done') return;
  const from = card.getBoundingClientRect();
  const to = bar.querySelectorAll('.sprint-pace-segment')[index]?.getBoundingClientRect() || bar.getBoundingClientRect();
  const targetX = to.left + to.width / 2;
  const targetY = to.top + to.height / 2;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clone = document.createElement('div');
  clone.className = 'sprint-flying-card is-flipping';
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  clone.style.left = `${from.left}px`;
  clone.style.top = `${from.top}px`;
  clone.style.width = `${from.width}px`;
  clone.style.height = `${from.height}px`;

  const flipper = document.createElement('div');
  flipper.className = 'sprint-sort-flipper';
  const front = visibleFace(card);
  const back = document.createElement('div');
  back.className = 'sprint-sort-back';
  back.style.background = `var(--pace-${level})`;
  back.style.color = level === 'later' ? 'var(--color-white)' : 'var(--text-primary)';
  back.textContent = LEVELS.find((item) => item.key === level)?.label || '';
  flipper.append(front, back);
  clone.append(flipper);
  document.body.appendChild(clone);
  card.style.opacity = '0';

  const dx = targetX - (from.left + from.width / 2);
  const dy = targetY - (from.top + from.height / 2);
  const sx = Math.max(.04, to.width / from.width);
  const sy = Math.max(.008, to.height / from.height);

  try {
    if (reduced) {
      await onTravel();
      return;
    }
    // 1. Turn over, towards the side it was sorted to.
    const turn = level === 'again' ? 180 : -180;
    const turning = flip
      ? flipper.animate([
          { transform: 'rotateY(0deg)' },
          { transform: `rotateY(${turn}deg)` },
        ], { duration: 400, easing: 'cubic-bezier(.45, .05, .35, 1)', fill: 'forwards' }).finished
      : Promise.resolve();

    // 2. Start rising before the turn has quite finished, so the two read as
    //    one follow-through instead of two separate steps.
    await wait(flip ? 280 : 0);
    const radius = parseFloat(getComputedStyle(back).borderTopLeftRadius) || 24;
    const travel = 640;
    const landing = clone.animate(landFrames(dx, dy, sx, sy), {
      duration: travel,
      easing: 'cubic-bezier(.45, .05, .2, 1)',
      fill: 'forwards',
    }).finished;
    // Keep the corners round as it flattens: the radius is scaled with the
    // card, so it has to grow to stay a capsule at the segment's size.
    back.animate([
      { borderRadius: `${radius}px` },
      { borderRadius: `${radius}px`, offset: .72 },
      { borderRadius: `${(to.height / 2) / sx}px / ${(to.height / 2) / sy}px` },
    ], { duration: travel, easing: 'cubic-bezier(.45, .05, .2, 1)', fill: 'forwards' });

    // 3. Colour the segment as the card arrives, so it lands into its own colour.
    await wait(travel * .62);
    await Promise.all([Promise.resolve(onTravel()), landing, turning]);
  } finally {
    clone.remove();
    card.style.opacity = '';
  }
}
