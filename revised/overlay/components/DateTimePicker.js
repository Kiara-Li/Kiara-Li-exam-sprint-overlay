// Native <input type="date"> and <input type="time"> render in the browser's
// locale, not the page's, so on a non-English machine the field reads in that
// language. This picker is authored entirely in the overlay, so every string
// on screen is English.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTE_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, index) => index * MINUTE_STEP);
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);

export function formatDateLabel(ms) {
  const date = new Date(ms);
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

export function formatTimeLabel(ms) {
  const date = new Date(ms);
  const hours = date.getHours();
  const meridiem = hours < 12 ? 'AM' : 'PM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(date.getMinutes()).padStart(2, '0')} ${meridiem}`;
}

export function dayKey(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Days of the visible month, padded to whole weeks. */
function monthGrid(monthAnchor) {
  const anchor = new Date(monthAnchor);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function calendarPanel(draft, monthAnchor, now) {
  const anchor = new Date(monthAnchor);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const selected = dayKey(draft);

  const cells = monthGrid(monthAnchor)
    .map((date) => {
      if (!date) return '<span class="ov-cal-cell is-empty"></span>';
      const past = date.getTime() < today.getTime();
      const isSelected = dayKey(date.getTime()) === selected;
      return `<button class="ov-cal-cell${isSelected ? ' is-selected' : ''}" aria-pressed="${isSelected}" aria-label="${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}" data-ov="pick-day" data-day="${date.getTime()}" ${past ? 'disabled' : ''}>${date.getDate()}</button>`;
    })
    .join('');

  return `
    <div class="ov-picker-panel" data-panel="date">
      <div class="ov-cal-head">
        <button class="ov-cal-nav" data-ov="shift-month" data-delta="-1" aria-label="Previous month"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6" /></svg></button>
        <strong>${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}</strong>
        <button class="ov-cal-nav" data-ov="shift-month" data-delta="1" aria-label="Next month"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg></button>
      </div>
      <div class="ov-cal-grid ov-cal-weekdays">${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="ov-cal-grid">${cells}</div>
    </div>`;
}

function wheel(name, label, values, current, format = String) {
  const items = values
    .map(
      (value) =>
        `<button type="button" class="ov-wheel-item${value === current ? ' is-selected' : ''}" data-ov="wheel-pick" data-value="${value}" tabindex="-1">${format(value)}</button>`,
    )
    .join('');
  return `<div class="ov-wheel" data-wheel="${name}" role="listbox" aria-label="${label}" tabindex="0">${items}</div>`;
}

/**
 * Three wheels, like the phone's own time picker: flick a column and it
 * settles on a value, or tap a value to bring it to the middle.
 */
export function timePanel(draft) {
  const date = new Date(draft);
  const hours = date.getHours();
  const currentHour = hours % 12 === 0 ? 12 : hours % 12;
  const currentMeridiem = hours < 12 ? 'AM' : 'PM';
  const currentMinute = (Math.round(date.getMinutes() / MINUTE_STEP) * MINUTE_STEP) % 60;

  return `
    <div class="ov-picker-panel" data-panel="time">
      <div class="ov-wheels">
        ${wheel('hour', 'Hour', HOURS, currentHour)}
        ${wheel('minute', 'Minutes', MINUTES, currentMinute, (value) => String(value).padStart(2, '0'))}
        ${wheel('meridiem', 'AM or PM', ['AM', 'PM'], currentMeridiem)}
      </div>
    </div>`;
}

export function dateTimePicker({ draft, open, monthAnchor, now, invalid = false }) {
  return `
    <div class="ov-when">
      <div class="ov-when-card">
        <button class="ov-when-field${open === 'date' ? ' is-open' : ''}" aria-expanded="${open === 'date'}"${invalid ? ' aria-invalid="true" aria-describedby="exam-time-error"' : ''} data-ov="open-picker" data-picker="date">
          <span>Date</span>
          <strong>${formatDateLabel(draft)}</strong>
        </button>
        <button class="ov-when-field${open === 'time' ? ' is-open' : ''}" aria-expanded="${open === 'time'}"${invalid ? ' aria-invalid="true" aria-describedby="exam-time-error"' : ''} data-ov="open-picker" data-picker="time">
          <span>Time</span>
          <strong>${formatTimeLabel(draft)}</strong>
        </button>
      </div>
      ${open === 'date' ? calendarPanel(draft, monthAnchor ?? draft, now) : ''}
      ${open === 'time' ? timePanel(draft) : ''}
    </div>`;
}

export function withDay(draft, dayMs) {
  const base = new Date(draft);
  const day = new Date(dayMs);
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes(), 0, 0);
  return next.getTime();
}

export function withHour(draft, hour12) {
  const date = new Date(draft);
  const isPm = date.getHours() >= 12;
  const hour24 = (hour12 % 12) + (isPm ? 12 : 0);
  date.setHours(hour24, date.getMinutes(), 0, 0);
  return date.getTime();
}

export function withMinute(draft, minute) {
  const date = new Date(draft);
  date.setMinutes(minute, 0, 0);
  return date.getTime();
}

export function withMeridiem(draft, meridiem) {
  const date = new Date(draft);
  const hour12 = date.getHours() % 12;
  date.setHours(meridiem === 'PM' ? hour12 + 12 : hour12, date.getMinutes(), 0, 0);
  return date.getTime();
}

export function shiftMonth(monthAnchor, delta) {
  const date = new Date(monthAnchor);
  date.setDate(1);
  date.setMonth(date.getMonth() + delta);
  return date.getTime();
}

/* ------------------------------------------------------------ time wheels */

function wheelIndex(wheel) {
  const row = wheel.firstElementChild?.offsetHeight || 1;
  return Math.max(0, Math.min(wheel.children.length - 1, Math.round(wheel.scrollTop / row)));
}

/** Puts each wheel on its selected value, without animating. */
export function settleWheels(scope) {
  scope.querySelectorAll('[data-wheel]').forEach((wheel) => {
    const selected = wheel.querySelector('.is-selected');
    if (selected) wheel.scrollTop = selected.offsetTop - wheel.firstElementChild.offsetTop;
  });
}

/**
 * Makes every time wheel inside `host` work, now and after re-renders.
 * `onPick(name, value)` is called once a wheel comes to rest on a value.
 */
export function attachTimeWheels(host, onPick) {
  const timers = new WeakMap();
  let ignoreClickUntil = 0;
  const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  // Scroll does not bubble, so it is caught on the way down. The value under
  // the band lights up while scrolling and is saved on rest.
  host.addEventListener('scroll', (event) => {
    const wheel = event.target;
    if (!wheel.dataset?.wheel) return;
    const index = wheelIndex(wheel);
    [...wheel.children].forEach((item, position) => item.classList.toggle('is-selected', position === index));
    window.clearTimeout(timers.get(wheel));
    timers.set(wheel, window.setTimeout(() => {
      if (wheel.isConnected) onPick(wheel.dataset.wheel, wheel.children[wheelIndex(wheel)].dataset.value);
    }, 110));
  }, true);

  // Tap a value to bring it to the middle.
  host.addEventListener('click', (event) => {
    const item = event.target.closest?.('[data-ov="wheel-pick"]');
    if (!item || Date.now() < ignoreClickUntil) return;
    const wheel = item.closest('[data-wheel]');
    wheel.scrollTo({ top: item.offsetTop - wheel.firstElementChild.offsetTop, behavior: smooth() });
  });

  host.addEventListener('keydown', (event) => {
    const wheel = event.target.closest?.('[data-wheel]');
    if (!wheel || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const row = wheel.firstElementChild.offsetHeight;
    wheel.scrollTo({ top: (wheelIndex(wheel) + (event.key === 'ArrowDown' ? 1 : -1)) * row });
  });

  // With a mouse there is no flick, so the wheel can be dragged instead.
  host.addEventListener('pointerdown', (event) => {
    const wheel = event.target.closest?.('[data-wheel]');
    if (!wheel || event.pointerType !== 'mouse' || event.button !== 0) return;
    const startY = event.clientY;
    const startTop = wheel.scrollTop;
    let moved = false;
    const move = (step) => {
      const delta = step.clientY - startY;
      if (!moved && Math.abs(delta) < 4) return;
      moved = true;
      wheel.classList.add('is-dragging');
      wheel.scrollTop = startTop - delta;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!moved) return;
      // The click that ends a drag is not a tap on a value.
      ignoreClickUntil = Date.now() + 120;
      wheel.classList.remove('is-dragging');
      wheel.scrollTo({ top: wheelIndex(wheel) * wheel.firstElementChild.offsetHeight, behavior: smooth() });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}
