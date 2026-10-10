import { actionButton } from './components.js';
import { answerButton } from '../base/components/components.js';
import { dateTimePicker, withDay, withHour, withMinute, withMeridiem, shiftMonth } from '../overlay/components/DateTimePicker.js';
import { chosenStudyMinutes, studyTimeCard } from '../overlay/screens/ExamSetup.js';
import { splitCard } from '../overlay/screens/PlanReady.js';
import { LEVELS } from '../overlay/components/PaceStudy.js';

// Answer cards take their feedback colours from the study screen's own rules.
document.documentElement.dataset.paceStudy = 'true';
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
const answer = (symbol, text) => `<span class="answer-symbol" aria-hidden="true">${symbol}</span><span>${text}</span>`;
const tokenNote = (token) => `<span data-color-value="${token}"></span>`;
$('#answers-demo').innerHTML = [
  ['Default', answerButton(answer('', 'Claude Monet'), 0)],
  [`Correct<span>Border ${tokenNote('--color-success-dark')} · fill ${tokenNote('--color-surface-green')}</span>`, answerButton(answer('✓', 'Claude Monet'), 1, 'is-correct')],
  [`Incorrect<span>Border ${tokenNote('--feedback-wrong')} · tinted fill</span>`, answerButton(answer('×', 'Pablo Picasso'), 2, 'is-wrong')],
].map(([label, card]) => specimen(label, card)).join('');

// Sliders -------------------------------------------------------------------
const studySetup = { selected: [0, 1, 2, 3], shaky: [2], examAt: now + (28 * 60 + 34) * 60000, studyMinutes: null };
const studyHost = $('#study-demo');
const drawStudy = () => { studyHost.innerHTML = studyTimeCard(studySetup, now); };
const studyAt = (track, x) => {
  const rect = track.querySelector('.ov-study-usable').getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (x - rect.left) / Math.max(1, rect.width)));
  const snapped = Math.round((fraction * Number(track.dataset.scale)) / 15) * 15;
  return Math.max(Number(track.dataset.min), Math.min(Number(track.dataset.max), snapped));
};
let dragging = false;
studyHost.addEventListener('pointerdown', (event) => {
  const track = event.target.closest('[data-study-track]');
  if (!track) return;
  event.preventDefault();
  dragging = true;
  studySetup.studyMinutes = studyAt(track, event.clientX);
  drawStudy();
});
window.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  studySetup.studyMinutes = studyAt(studyHost.querySelector('[data-study-track]'), event.clientX);
  drawStudy();
});
window.addEventListener('pointerup', () => { dragging = false; });
studyHost.addEventListener('click', (event) => {
  if (!event.target.closest('[data-ov="study-recommended"]')) return;
  studySetup.studyMinutes = null;
  drawStudy();
});
studyHost.addEventListener('change', (event) => {
  if (!event.target.closest('[data-study-input]')) return;
  const read = (name) => Math.max(0, Math.round(Number(studyHost.querySelector(`[data-study-input="${name}"]`).value) || 0));
  const { min, max } = chosenStudyMinutes(studySetup, now);
  studySetup.studyMinutes = Math.max(min, Math.min(max, read('hours') * 60 + read('minutes')));
  drawStudy();
});
drawStudy();

const splitChapter = { order: 0, short: 'Chapter 1', shaky: false, allotted: 20, stages: { flashcards: 0.3, learn: 0.7 } };
$('#split-demo').innerHTML = splitCard(splitChapter);
$('#split-demo').addEventListener('input', (event) => {
  const input = event.target.closest('[data-stage-split]');
  if (!input) return;
  const minutes = Math.round(splitChapter.allotted * Number(input.value) / 100);
  input.style.setProperty('--split', `${input.value}%`);
  $('#split-demo [data-flash-minutes]').textContent = `${minutes} min`;
  $('#split-demo [data-quiz-minutes]').textContent = `${splitChapter.allotted - minutes} min`;
});

// What the three sort colours mean, in the words the buttons use.
$('#sorting-legend').innerHTML = LEVELS.map((level) => `
  <div class="ds-legend-item" style="--legend-ink:var(--sort-${level.key});--legend-surface:var(--sort-${level.key}-surface);--legend-bar:var(--pace-${level.key === 'done' ? 'complete' : level.key})">
    <span class="ds-legend-chip">${level.label}</span>
    <i class="ds-legend-bar" aria-hidden="true"></i>
    <p class="ds-meta">${level.next}<span>${{ again: 'Returns after a few cards', later: 'Moves to the end of this set', done: 'Leaves the queue and fills the bar' }[level.key]}</span></p>
  </div>`).join('');
document.querySelectorAll('[data-type-value]').forEach((element) => {
  const style = getComputedStyle($(`.ds-type-${element.dataset.typeValue}`));
  element.textContent = `${style.fontSize} · ${style.fontWeight}`;
});
document.querySelectorAll('[data-color-value]').forEach((element) => {
  element.textContent = getComputedStyle(document.documentElement).getPropertyValue(element.dataset.colorValue).trim().toUpperCase();
});
