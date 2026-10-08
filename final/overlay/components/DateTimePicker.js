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
const MINUTES = [0, 15, 30, 45];

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

function calendarPanel(draft, monthAnchor, now) {
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
        <button class="ov-cal-nav" data-ov="shift-month" data-delta="-1" aria-label="Previous month">‹</button>
        <strong>${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}</strong>
        <button class="ov-cal-nav" data-ov="shift-month" data-delta="1" aria-label="Next month">›</button>
      </div>
      <div class="ov-cal-grid ov-cal-weekdays">${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="ov-cal-grid">${cells}</div>
    </div>`;
}

function timePanel(draft) {
  const date = new Date(draft);
  const hours = date.getHours();
  const currentHour = hours % 12 === 0 ? 12 : hours % 12;
  const currentMeridiem = hours < 12 ? 'AM' : 'PM';
  const currentMinute = MINUTES.reduce(
    (best, value) => (Math.abs(value - date.getMinutes()) < Math.abs(best - date.getMinutes()) ? value : best),
    MINUTES[0],
  );

  const hourChips = Array.from({ length: 12 }, (_, index) => index + 1)
    .map(
      (hour) =>
        `<button class="ov-time-chip${hour === currentHour ? ' is-selected' : ''}" aria-pressed="${hour === currentHour}" data-ov="pick-hour" data-hour="${hour}">${hour}</button>`,
    )
    .join('');

  const minuteChips = MINUTES.map(
    (minute) =>
      `<button class="ov-time-chip${minute === currentMinute ? ' is-selected' : ''}" aria-pressed="${minute === currentMinute}" data-ov="pick-minute" data-minute="${minute}">:${String(minute).padStart(2, '0')}</button>`,
  ).join('');

  const meridiemChips = ['AM', 'PM']
    .map(
      (value) =>
        `<button class="ov-time-chip${value === currentMeridiem ? ' is-selected' : ''}" aria-pressed="${value === currentMeridiem}" data-ov="pick-meridiem" data-meridiem="${value}">${value}</button>`,
    )
    .join('');

  return `
    <div class="ov-picker-panel" data-panel="time">
      <p class="ov-picker-label">Hour</p>
      <div class="ov-time-grid is-hours">${hourChips}</div>
      <p class="ov-picker-label">Minutes</p>
      <div class="ov-time-grid">${minuteChips}</div>
      <p class="ov-picker-label">AM / PM</p>
      <div class="ov-time-grid">${meridiemChips}</div>
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
