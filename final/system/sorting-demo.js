// The Final sorting specimen uses the same controls and motion as Chapter 1.
import { paceMarkup, sortStrip, sortDestination, bindSortGesture, flyIntoPace, animateSegmentMove } from '../overlay/components/PaceStudy.js';
import { course } from '../base/data.js';

const cards = course.sets[0].terms.slice(0, 8);

export function mountSortingDemo(host) {
  let queue = cards.map((_, index) => index);
  let position = 0;
  let flipped = false;
  let sorting = false;
  let sortCount = 0;
  const statuses = new Map();
  let stageAt = performance.now();

  host.innerHTML = `<div class="sort-demo">
    <div class="sort-phone">
      <div class="sort-head"><strong>Flashcards</strong><button type="button" class="sort-restart" data-sort-restart>Restart</button></div>
      <div class="sort-pace"></div>
      <div class="sort-count"></div>
      <div class="sort-stage"><button type="button" class="sort-card" aria-label="Flip card"><span class="sort-term"></span></button></div>
      <div class="sort-controls">${sortStrip(['again', 'later', 'done'], { hint: true })}</div>
      <div class="sort-finish" hidden><strong>Flashcards done.</strong><button type="button" class="primary-button button-compact" data-sort-restart>Try again</button></div>
      <div class="sort-live" role="status"></div>
    </div>
  </div>`;

  const card = host.querySelector('.sort-card');
  const term = host.querySelector('.sort-term');
  const count = host.querySelector('.sort-count');
  const buttons = [...host.querySelectorAll('[data-pace-sort]')];
  const dismissHint = () => host.querySelector('.sprint-first-hint')?.remove();

  function render() {
    const complete = position >= queue.length;
    host.querySelector('.sprint-sort-next').style.display = sortCount >= 3 ? 'none' : '';
    host.querySelector('.sort-pace').innerHTML = paceMarkup({
      completed: position, items: queue, statuses, target: Math.min(1, (performance.now() - stageAt) / 30000),
    });
    count.textContent = `${position} / ${queue.length}`;
    host.querySelector('.sort-stage').hidden = complete;
    host.querySelector('.sort-controls').hidden = complete;
    host.querySelector('.sort-finish').hidden = !complete;
    if (!complete) {
      term.textContent = cards[queue[position]][flipped ? 1 : 0];
      card.dataset.side = flipped ? 'back' : 'front';
    }
  }

  async function sort(level, via) {
    if (sorting || position >= queue.length) return;
    sorting = true;
    buttons.forEach(button => { button.disabled = true; });
    const current = queue[position];
    const destination = sortDestination(position, queue.length, level);
    const track = host.querySelector('.sprint-pace-track');
    // Same sequence as the study screen: turn over, travel, and colour the
    // segment as the card arrives.
    await flyIntoPace(card, track, destination, queue.length, level, {
      onTravel: () => animateSegmentMove(track, position, destination, level),
    }).catch(() => {});
    if (level === 'done') position += 1;
    else {
      queue.splice(position, 1);
      queue.splice(destination, 0, current);
    }
    statuses.set(current, level);
    sortCount += 1;
    flipped = false;
    card.style.transform = '';
    delete card.dataset.sortPreview;
    buttons.forEach(button => { button.disabled = false; button.classList.remove('is-active'); });
    sorting = false;
    host.querySelector('.sort-live').textContent = `${level === 'again' ? "Don't know" : level === 'later' ? 'Kind of' : 'Got it'} · ${via}`;
    render();
    // Same settle-in as the study screen, so the gallery shows the real motion.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      card.animate([
        { opacity: 0, transform: 'translate3d(0, 12px, 0) scale(.97)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
      ], { duration: 380, easing: 'cubic-bezier(.2, .9, .3, 1.06)' });
    }
  }

  const binding = bindSortGesture(card, {
    allowed: ['again', 'done'],
    onChoose: sort,
    onInteract: dismissHint,
    onPreview: level => buttons.forEach(button => button.classList.toggle('is-active', button.dataset.paceSort === level)),
  });
  card.addEventListener('click', () => {
    if (sorting || position >= queue.length) return;
    flipped = !flipped;
    render();
  });
  buttons.forEach(button => button.addEventListener('click', () => {
    dismissHint();
    if (button.dataset.paceSort === 'later') sort('later', 'button');
    else binding.choose(button.dataset.paceSort, 'button');
  }));
  host.querySelectorAll('[data-sort-restart]').forEach(button => button.addEventListener('click', () => {
    if (sorting) return;
    queue = cards.map((_, index) => index);
    position = 0;
    flipped = false;
    statuses.clear();
    sortCount = 0;
    stageAt = performance.now();
    render();
  }));
  render();
  window.setInterval(() => {
    const track = host.querySelector('.sprint-pace-track');
    if (track) track.style.setProperty('--pace-target', `${Math.min(100, (performance.now() - stageAt) / 300)}%`);
  }, 100);
}

const host = document.querySelector('#sorting-demo');
if (host) mountSortingDemo(host);
