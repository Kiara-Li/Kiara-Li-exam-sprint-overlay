import { actionButton } from './components.js';
import { answerButton } from '../base/components/components.js';
import { dateTimePicker, withDay, withHour, withMinute, withMeridiem, shiftMonth } from '../overlay/components/DateTimePicker.js';
const $ = (selector) => document.querySelector(selector);
const specimen = (label, content) => `<figure>${content}<figcaption class="ds-meta">${label}</figcaption></figure>`;
$('#button-variants').innerHTML = [
  ['Primary', actionButton({ label: 'Continue' })],
  ['Secondary', actionButton({ label: 'Study again', variant: 'secondary' })],
  ['Text', actionButton({ label: 'Cancel', variant: 'text' })],
].map(([label, button]) => specimen(label, button)).join('');
$('#button-states').innerHTML = [
  ['Compact', actionButton({ label: 'Continue', compact: true })],
  ['Focus', actionButton({ label: 'Continue', compact: true }).replace('<button ', '<button data-preview-state="focus" ')],
  ['Disabled', actionButton({ label: 'Continue', compact: true, disabled: true })],
  ['Loading', actionButton({ label: 'Loading…', compact: true, loading: true })],
].map(([label, button]) => specimen(label, button)).join('');
const now = Date.now();
const draft = new Date(now);
draft.setDate(draft.getDate() + 1);
draft.setHours(9, 0, 0, 0);
const state = { date: draft.getTime(), month: draft.getTime(), picker: null, invalid: false };
function dates() {
  $('#date-demo').innerHTML = dateTimePicker({ draft: state.date, open: state.picker, monthAnchor: state.month, now, invalid: state.invalid }) + (state.invalid ? '<p class="ov-inline-warning" id="exam-time-error" role="alert">Pick a future date and time.</p>' : '');
}
dates();
$('#field-error-toggle').addEventListener('click', () => {
  state.invalid = !state.invalid;
  $('#field-error-toggle').setAttribute('aria-pressed', String(state.invalid));
  dates();
});
$('#date-demo').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-ov]');
  if (!button) return;
  const action = button.dataset.ov;
  if (action === 'open-picker') state.picker = state.picker === button.dataset.picker ? null : button.dataset.picker;
  if (action === 'shift-month') state.month = shiftMonth(state.month, Number(button.dataset.delta));
  if (action === 'pick-day') { state.date = withDay(state.date, Number(button.dataset.day)); state.picker = null; }
  if (action === 'pick-hour') state.date = withHour(state.date, Number(button.dataset.hour));
  if (action === 'pick-minute') state.date = withMinute(state.date, Number(button.dataset.minute));
  if (action === 'pick-meridiem') state.date = withMeridiem(state.date, button.dataset.meridiem);
  dates();
  const focusTarget = action === 'pick-day' ? '[data-picker="date"]' : action === 'open-picker' ? `[data-picker="${button.dataset.picker}"]` : `[data-ov="${action}"]${button.dataset.delta ? `[data-delta="${button.dataset.delta}"]` : '[aria-pressed="true"]'}`;
  $('#date-demo').querySelector(focusTarget)?.focus({ preventScroll: true });
});

$('#date-demo').addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = state.picker;
  state.picker = null;
  dates();
  $('#date-demo').querySelector(`[data-picker="${open}"]`)?.focus();
});
$('#answers-demo').innerHTML = [
  ['Default', answerButton('Claude Monet', 0)],
  ['Correct', answerButton('✓ Claude Monet', 1, 'is-correct')],
  ['Incorrect', answerButton('✕ Pablo Picasso', 2, 'is-wrong')],
].map(([label, card]) => specimen(label, card)).join('');
document.querySelectorAll('[data-type-value]').forEach((element) => {
  const style = getComputedStyle($(`.ds-type-${element.dataset.typeValue}`));
  element.textContent = `${style.fontSize} · ${style.fontWeight}`;
});
document.querySelectorAll('[data-color-value]').forEach((element) => {
  element.textContent = getComputedStyle(document.documentElement).getPropertyValue(element.dataset.colorValue).trim().toUpperCase();
});
