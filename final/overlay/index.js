// Exam Sprint overlay.
// Renders on top of the base reproduction and never modifies it: everything
// it needs from the base arrives through base/extensions.js hooks and the
// window.__base API. In `original` mode the hooks are cleared and this layer
// is inert.

import { course } from '../base/data.js';
import { isDemo } from '../base/demo-data.js';
import { clearHooks, setHooks } from '../base/extensions.js';
import { clock, formatClockTime, formatDuration } from './state/clock.js';
import * as Plan from './state/sprintPlan.js';
import { islandContent, islandShell } from './components/Island.js';
import { adjustSheet, parkedSheet, sheet } from './components/ParkedSheet.js';
import { saveGlyph } from './components/glyphs.js';
import { paceMarkup, sortStrip, sortDestination, bindSortGesture, flyIntoPace, animateSegmentMove } from './components/PaceStudy.js';
import {
  addTimeAlert,
  aheadAlert,
  mildAlert,
  parkedAlert,
  severeSheet,
  stuckAlert,
} from './components/SprintAlert.js';
import { chosenStudyMinutes, defaultDraft, examSetup, playStudyIntro } from './screens/ExamSetup.js';
import {
  shiftMonth,
  withDay,
  withHour,
  withMeridiem,
  withMinute,
} from './components/DateTimePicker.js';
import { planBuilding, planError, planReady, paceIntro } from './screens/PlanReady.js';
import { chapterDone, playReallocation } from './screens/ChapterDone.js';
import { sprintDone } from './screens/SprintDone.js';
import { flashDone, playFlashDone } from './screens/FlashDone.js';
import { debugPanel } from './debug/DebugPanel.js';
import { modeBar } from './debug/ModeBar.js';

const params = new URLSearchParams(window.location.search);

function freshPace() {
  return {
    stageAt: 0,
    statuses: { flashcards: new Map(), learn: new Map() },
    wasBehind: { flashcards: false, learn: false },
    lastCatchAt: -Infinity,
    hintsSeen: { flashcards: false, learn: false, pace: false },
    sortCount: { flashcards: 0, learn: 0 },
    needsPractice: new Set(),
    againCounts: { flashcards: new Map(), learn: new Map() },
    decision: null,
    toast: null,
    toastUntil: 0,
    lastMessage: '',
    sorting: false,
  };
}

const ov = {
  demo: isDemo,
  mode: params.get('mode') === 'original' ? 'original' : 'sprint',
  phase: 'idle',
  plan: null,
  chapterIndex: 0,
  stage: 'flashcards',
  chapterStartedAt: 0,
  flashBonus: 0,
  flashPrompted: false,
  island: { state: 'compact', alert: null, message: '' },
  sheet: null,
  severe: null,
  setup: {
    examAt: null,
    draftAt: null,
    monthAnchor: null,
    picker: null,
    selected: [],
    shaky: [],
    error: null,
  },
  coachShown: false,
  spotlightDone: false,
  entryTapped: false,
  suspended: null,
  reviewTerm: null,
  stats: { parkedSolved: 0 },
  debugOpen: params.get('debug') === '1',
  forcedPlanError: false,
  log: [],
  phaseEnteredAt: Date.now(),
  pace: freshPace(),
};

let root = null;
let islandNode = null;
let unsubscribeClock = null;
let celebrateTimer = null;
let suppressClickUntil = 0;
let paceBinding = null;
let correctAdvanceTimer = null;

/* ------------------------------------------------------------------ setup */

function injectStyles() {
  if (document.querySelector('link[data-overlay-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './overlay/overlay.css';
  link.dataset.overlayStyles = 'true';
  document.head.appendChild(link);
}

function buildRoot() {
  root = document.createElement('div');
  root.id = 'ov-root';
  root.innerHTML = `
    <div class="ov-layer ov-screen-layer" data-layer="screen"></div>
    <div class="ov-layer ov-sheet-layer" data-layer="sheet"></div>
    <div class="ov-layer ov-island-layer" data-layer="island"></div>
    <div class="ov-layer ov-debug-layer" data-layer="debug"></div>
    <div class="ov-bar-layer" data-layer="bar"></div>`;
  document.body.appendChild(root);
  const wrap = islandShell();
  root.querySelector('[data-layer="island"]').appendChild(wrap);
  islandNode = wrap.querySelector('[data-island]');
  // Keep the study content below the timer throughout its height transition.
  // Measuring only on the clock tick leaves the expanding controls overlapping.
  new ResizeObserver(measureIsland).observe(islandNode);
  attachIslandGestures(wrap);
}

/* ------------------------------------------------------------- session log */

function logEvent(type, detail = {}) {
  ov.log.push({
    at: new Date().toISOString(),
    virtualAt: new Date(clock.now()).toISOString(),
    phase: ov.phase,
    chapter: ov.plan ? ov.plan.chapters[ov.chapterIndex]?.short : null,
    type,
    detail,
  });
  const counter = root?.querySelector('[data-dbg-count]');
  if (counter) counter.textContent = String(ov.log.length);
}

function setPhase(phase) {
  if (ov.phase === phase) return;
  logEvent('screen-leave', { phase: ov.phase, msOnScreen: Date.now() - ov.phaseEnteredAt });
  ov.phase = phase;
  ov.phaseEnteredAt = Date.now();
  logEvent('screen-enter', { phase });
}

/* ------------------------------------------------------------------ render */

function activeChapter() {
  return ov.plan ? ov.plan.chapters[ov.chapterIndex] : null;
}

// Every screen that is part of studying, so the island is never missing from
// one of them and made to look like a one-screen feature.
const STUDY_ROUTES = new Set([
  'flashcards',
  'quiz',
  'test',
  'test-setup',
  'flash-complete',
  'learn-complete',
]);

function onStudyScreen() {
  return STUDY_ROUTES.has(window.__base.state.route);
}

/** A plan is running and the user is inside it. */
function sprintRunning() {
  return ov.mode === 'sprint' && ov.phase === 'study' && !!ov.plan;
}

function chapterOnePace() {
  return sprintRunning() && activeChapter()?.setIndex === 0;
}

// Phases where the overlay draws a full screen of its own over the base.
const OVERLAY_SCREENS = new Set([
  'pace-intro',
  'setup',
  'building',
  'plan-error',
  'plan',
  'chapter-done',
  'sprint-done',
]);

/**
 * The island is part of every study screen in sprint mode, with or without a
 * plan. Reaching Learn straight from the set overview used to leave the screen
 * bare, which made the whole idea look optional. It stays out of the overlay's
 * own screens, which already own the whole canvas.
 */
function islandVisible() {
  if (chapterOnePace() && ['flashcards', 'learn', 'transition'].includes(ov.stage)) return false;
  return ov.mode === 'sprint' && !OVERLAY_SCREENS.has(ov.phase) && onStudyScreen();
}

/** Flashcards / Learn / Test, taken from the base when no plan is running. */
function currentStage() {
  if (sprintRunning()) return ov.stage;
  const route = window.__base.state.route;
  if (route === 'flashcards' || route === 'flash-complete') return 'flashcards';
  if (route === 'quiz' || route === 'learn-complete') return 'learn';
  return 'test';
}

function spotlightVisible() {
  return false;
}

function enhanceEntry() {
  if (ov.mode !== 'sprint') return;
  const app = document.querySelector('#app');
  if (window.__base.state.route === 'folder') {
    const button = app.querySelector('.sticky-action button');
    if (button) {
      button.textContent = 'Prepare for exam';
    }
    app.querySelectorAll('[data-open-set]').forEach(button => {
      if (Number(button.dataset.openSet) > 0) button.disabled = true;
    });
    const description = app.querySelector('.set-list [data-open-set="0"] small');
    if (description) description.textContent = `${Plan.CHAPTER_TERM_COUNT} cards · Exam sprint`;
  }
  app.querySelectorAll('[data-nav="test-setup"], [data-nav="test"]').forEach(button => { button.disabled = true; });
}

function render() {
  if (!root) return;
  document.documentElement.dataset.finalSprint = ov.mode === 'sprint' ? 'true' : 'false';
  enhanceEntry();
  root.dataset.mode = ov.mode;
  window.requestAnimationFrame(measureIsland);
  window.setTimeout(measureIsland, 420);

  const screenLayer = root.querySelector('[data-layer="screen"]');
  const screenKey = `${ov.phase}:${ov.phase === 'setup' ? ov.setup.step || 0 : ''}`;
  const screenChanged = screenLayer.dataset.screenKey !== screenKey;
  screenLayer.dataset.screenKey = screenKey;
  const sheetLayer = root.querySelector('[data-layer="sheet"]');
  const debugLayer = root.querySelector('[data-layer="debug"]');
  const barLayer = root.querySelector('[data-layer="bar"]');

  let screen = '';
  if (ov.mode === 'sprint') {
    if (ov.phase === 'setup') screen = examSetup(ov.setup, clock.now());
    if (ov.phase === 'building') screen = planBuilding(ov.setup.selected.map(index => Plan.shortTitle(course.sets[index].chapter)));
    if (ov.phase === 'plan-error') screen = planError();
    if (ov.phase === 'plan') screen = planReady(ov.plan);
    if (ov.phase === 'pace-intro') screen = paceIntro();
    if (ov.phase === 'chapter-done') screen = chapterDone(ov.plan, ov.chapterIndex);
    if (ov.phase === 'sprint-done') screen = sprintDone(ov.plan, sprintStats());
  }
  const needsShell = Boolean(screen);
  const hadChapterDone = Boolean(screenLayer.querySelector('.ov-chapter-done'));
  screenLayer.innerHTML = needsShell ? `<div class="phone-shell">${screen}</div>` : '';
  if (screenChanged && ov.phase === 'setup' && ov.setup.step === 3) playStudyIntro(screenLayer);
  screenLayer.classList.toggle('is-visible', needsShell);
  if (screenChanged) screenLayer.scrollTop = 0;
  if (ov.phase === 'chapter-done' && !hadChapterDone) {
    window.requestAnimationFrame(() => playReallocation(screenLayer));
  }

  let sheetMarkup = '';
  if (ov.mode === 'sprint' && ov.sheet === 'leave') sheetMarkup = sheet({
    name: 'leave', title: 'Leave this session?', body: '<p>Your progress will be saved.</p>',
    footer: '<button class="primary-button ov-full" data-ov="keep-session">Keep studying</button><button class="soft-button ov-full" data-ov="leave-session">Leave</button>',
  });
  if (ov.mode === 'sprint' && ov.sheet === 'resume') sheetMarkup = sheet({
    name: 'resume', title: 'Pick up where you left off?',
    footer: '<button class="primary-button ov-full" data-ov="continue-session">Continue</button><button class="soft-button ov-full" data-ov="restart-session">Start over</button>',
  });
  if (ov.mode === 'sprint' && ov.sheet === 'parked') {
    sheetMarkup = parkedSheet(ov.plan, { inReview: ov.stage === 'review' });
  }
  if (ov.mode === 'sprint' && ov.sheet === 'adjust') sheetMarkup = adjustSheet(ov.plan);
  if (ov.mode === 'sprint' && ov.sheet === 'severe' && ov.severe) sheetMarkup = severeSheet(ov.severe);
  if (ov.mode === 'sprint' && ov.sheet === 'review' && ov.reviewTerm) sheetMarkup = reviewSheet();
  const keepAdjustSheet = ov.sheet === 'adjust' && sheetLayer.dataset.sheet === 'adjust' && sheetLayer.firstElementChild;
  if (!keepAdjustSheet) sheetLayer.innerHTML = sheetMarkup;
  sheetLayer.dataset.sheet = ov.sheet || '';
  sheetLayer.classList.toggle('is-visible', Boolean(sheetMarkup));
  document.documentElement.dataset.spotlight = 'false';

  debugLayer.innerHTML = ov.debugOpen ? debugPanel(ov) : '';
  debugLayer.classList.toggle('is-visible', ov.debugOpen);
  barLayer.innerHTML = modeBar(ov);

  document.documentElement.dataset.sprintActive = islandVisible() ? 'true' : 'false';
  document.documentElement.dataset.paceStudy = chapterOnePace() && ['flashcards', 'learn'].includes(ov.stage) ? 'true' : 'false';
  updateIsland();
}

function reviewSheet() {
  const { setIndex, termIndex } = ov.reviewTerm;
  const [term, definition] = course.sets[setIndex].terms[termIndex];
  return sheet({
    name: 'review',
    title: 'Review this card',
    body: `<div class="ov-review-card"><strong>${term}</strong><p>${definition}</p></div>`,
    footer: '<button class="primary-button ov-full" data-ov="dismiss-sheet">Back to the question</button>',
  });
}

function updateIsland() {
  if (!islandNode) return;
  const wrap = islandNode.parentElement;
  wrap.classList.toggle('is-visible', islandVisible());
  if (!islandVisible()) {
    if (chapterOnePace() && ['flashcards', 'learn', 'transition'].includes(ov.stage)) {
      islandNode.innerHTML = '';
      delete islandNode.dataset.signature;
    }
    return;
  }
  islandNode.dataset.state = ov.plan ? ov.island.state : 'unplanned';
  const next = islandContent(ov, { planned: Boolean(ov.plan), stage: currentStage() });
  if (islandNode.dataset.signature !== next) {
    islandNode.innerHTML = next;
    islandNode.dataset.signature = next;
  }
  measureIsland();
}

/**
 * Publishes the island's real height so the base screen below it can keep
 * clear of it in every state, not just the compact one.
 */
function measureIsland() {
  if (!islandNode) return;
  const height = islandNode.getBoundingClientRect().height;
  if (!height) return;
  document.documentElement.style.setProperty('--island-live-height', `${Math.round(height)}px`);
}

/* ---------------------------------------------------- Chapter 1 pace study */

function paceQueue() {
  const state = window.__base.state;
  return ov.stage === 'flashcards'
    ? { completed: state.queuePosition, items: state.studyQueue, termIndex: state.cardIndex }
    : { completed: state.learn.pos, items: state.learn.questions, termIndex: state.learn.questions[state.learn.pos]?.termIndex };
}

function paceFraction() {
  const planned = ov.demo ? (ov.stage === 'flashcards' ? 120000 : 180000) : Math.max(1, Plan.stageMinutes(activeChapter(), ov.stage)) * 60000;
  return Math.max(0, Math.min(1, (clock.now() - ov.pace.stageAt) / planned));
}

function liveToast() {
  return clock.now() < ov.pace.toastUntil ? ov.pace.toast : null;
}

function showPaceMessage(text, kind = 'warning', persistent = false) {
  if (ov.pace.lastMessage === text && !persistent) return;
  ov.pace.lastMessage = text;
  logEvent('pace-message', { message: text, kind });
  if (!persistent) {
    ov.pace.toast = { text, kind };
    ov.pace.toastUntil = clock.now() + 3000;
    const toast = document.querySelector('#app .sprint-pace-toast');
    if (toast) {
      toast.textContent = text;
      toast.className = `sprint-pace-toast is-fading${kind === 'good' ? ' is-good' : ''}`;
    }
  }
}

function checkPaceMessage() {
  if (!chapterOnePace() || !['flashcards', 'learn'].includes(ov.stage) || ov.pace.decision) return;
  const { completed, items } = paceQueue();
  const difference = completed / Math.max(1, items.length) - paceFraction();
  if (difference >= .2) showPaceMessage("You're ahead of pace. Nice.", 'good');
  else if (difference <= -.2) showPaceMessage("You're a little behind. Sort the hard ones later to keep moving.");
}

function celebratePaceCatch(track) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = track.querySelector('.sprint-pace-target');
  const you = track.querySelector('.sprint-pace-you');
  if (!target || !you) return;
  const distance = you.getBoundingClientRect().left - target.getBoundingClientRect().left;
  const verticalDistance = you.getBoundingClientRect().top - target.getBoundingClientRect().top;
  track.style.setProperty('--catch-dx', `${distance}px`);
  track.style.setProperty('--catch-dy', `${verticalDistance}px`);
  track.classList.remove('is-caught');
  void track.offsetWidth;
  track.classList.add('is-caught');
  window.setTimeout(() => track.classList.remove('is-caught'), 700);
}

function updatePaceMarker() {
  if (!chapterOnePace() || !['flashcards', 'learn'].includes(ov.stage)) return;
  const track = document.querySelector('#app .sprint-pace-track');
  if (!track) return;
  const target = paceFraction();
  const { completed, items } = paceQueue();
  const you = completed / Math.max(1, items.length);
  track.style.setProperty('--pace-target', `${Math.round(target * 10000) / 100}%`);
  track.style.setProperty('--pace-you', `${Math.round(you * 10000) / 100}%`);
  if (target - you >= .2) ov.pace.wasBehind[ov.stage] = true;
  if (ov.pace.wasBehind[ov.stage] && you >= target) {
    ov.pace.wasBehind[ov.stage] = false;
    if (Date.now() - ov.pace.lastCatchAt >= 30000) {
      ov.pace.lastCatchAt = Date.now();
      celebratePaceCatch(track);
    }
  }
  if (!liveToast()) {
    const toast = document.querySelector('#app .sprint-pace-toast');
    if (toast) { toast.textContent = ''; toast.className = 'sprint-pace-toast'; }
  }
  checkPaceMessage();
}

function dismissPaceHint(stage) {
  ov.pace.hintsSeen[stage] = true;
  ov.pace.hintsSeen.pace = true;
  document.querySelector('#app .sprint-first-hint')?.remove();
  document.querySelector('#app .sprint-pace-intro')?.remove();
}

function paceControls(screen, stage, allowed, card) {
  const buttons = [...screen.querySelectorAll('[data-pace-sort]')];
  const choose = (level, via) => sortPaceItem(level, via, card);
  const preview = (level) => buttons.forEach(button => button.classList.toggle('is-active', button.dataset.paceSort === level));
  paceBinding = bindSortGesture(card, {
    allowed: allowed.filter(level => level !== 'later' || stage === 'learn'),
    onChoose: choose,
    onInteract: () => dismissPaceHint(stage),
    onPreview: preview,
  });
  card.addEventListener('keydown', () => dismissPaceHint(stage));
  card.addEventListener('click', () => dismissPaceHint(stage));
  buttons.forEach(button => button.addEventListener('click', () => {
    dismissPaceHint(stage);
    if (button.dataset.paceSort === 'later' && stage === 'flashcards') sortPaceItem('later', 'button', card);
    else paceBinding?.choose(button.dataset.paceSort, 'button');
  }));
}

function enhancePaceScreen() {
  paceBinding?.dispose();
  paceBinding = null;
  const screen = document.querySelector('#app .screen');
  if (!screen) return;
  const stage = ov.stage;
  const route = window.__base.state.route;
  const studying = chapterOnePace() && ((stage === 'flashcards' && route === 'flashcards') || (stage === 'learn' && route === 'quiz'));
  document.documentElement.dataset.paceStudy = studying ? 'true' : 'false';
  if (!chapterOnePace()) return;
  if (stage === 'transition' && route === 'flash-complete') {
    const count = ov.pace.needsPractice.size;
    const got = Math.max(0, Plan.termScope(course.sets[0]).length - count);
    const content = screen.querySelector('.flash-complete-content');
    content.innerHTML = flashDone({ got, practice: count, chapter: 'Chapter 1' });
    playFlashDone(content);
    return;
  }
  if (!studying) return;
  screen.querySelector('.progress-line, .segmented-progress')?.remove();
  screen.querySelector('.mastery-counts')?.remove();
  screen.querySelector('.feedback-action')?.remove();
  const { completed, items } = paceQueue();
  const header = screen.querySelector('.app-header');
  header.insertAdjacentHTML('afterend', paceMarkup({
    completed, items, statuses: ov.pace.statuses[stage],
    target: paceFraction(), toast: liveToast(), decision: ov.pace.decision,
    intro: stage === 'flashcards' && !ov.pace.hintsSeen.pace,
  }));
  if (stage === 'flashcards') {
    screen.querySelector('.app-header-title').textContent = '';
    const card = screen.querySelector('.flashcard-stage');
    card.classList.add('sprint-sort-stage');
    card.insertAdjacentHTML('beforebegin', `<div class="sprint-pace-number">${completed} / ${items.length}</div>`);
    const area = screen.querySelector('.rating-area');
    area.outerHTML = sortStrip(['again', 'later', 'done'], { hint: !ov.pace.hintsSeen.flashcards, details: ov.pace.sortCount.flashcards < 3 });
    paceControls(screen, stage, ['again', 'done'], card);
  } else {
    const question = screen.querySelector('[data-question-card]');
    question.classList.add('sprint-question-sort');
    question.insertAdjacentHTML('beforebegin', `<div class="sprint-pace-number">${completed} / ${items.length}</div>`);
    const learn = window.__base.state.learn;
    const current = learn.questions[learn.pos];
    const wrong = learn.answer !== null && learn.answer !== current?.correct;
    if (wrong) {
      question.classList.add('sprint-question-card');
      question.insertAdjacentHTML('afterend', sortStrip(['again', 'later'], { hint: !ov.pace.hintsSeen.learn, details: ov.pace.sortCount.learn < 3 }));
      paceControls(screen, stage, ['again', 'later'], question);
    }
  }
}

async function sortPaceItem(level, via, card, { bypassPrompt = false, auto = false } = {}) {
  if (!chapterOnePace() || !['flashcards', 'learn'].includes(ov.stage)) return;
  if (ov.pace.sorting) return;
  if (ov.pace.decision && !bypassPrompt) return;
  const stage = ov.stage;
  const { completed, items, termIndex } = paceQueue();
  const previousAgain = ov.pace.againCounts[stage].get(termIndex) || 0;
  if (level === 'again' && previousAgain >= 1 && !bypassPrompt) {
    ov.pace.decision = { stage, termIndex };
    showPaceMessage('This one keeps coming back. Move it later?', 'warning', true);
    const shell = document.querySelector('#app .sprint-pace-shell');
    if (shell) shell.outerHTML = paceMarkup({
      completed, items, statuses: ov.pace.statuses[stage],
      target: paceFraction(), toast: liveToast(), decision: true,
    });
    return;
  }
  ov.pace.sorting = true;
  const destination = sortDestination(completed, items.length, level);
  const track = document.querySelector('#app .sprint-pace-track');
  if (level !== 'done') await flyIntoPace(
      stage === 'flashcards' ? card.querySelector('.flashcard') : card,
      track, destination, items.length, level,
      { onTravel: () => animateSegmentMove(track, completed, destination, level) },
    ).catch(() => {});
  if (!chapterOnePace() || ov.stage !== stage || paceQueue().termIndex !== termIndex) {
    ov.pace.sorting = false;
    return;
  }
  if (level === 'again') ov.pace.againCounts[stage].set(termIndex, previousAgain + 1);
  else ov.pace.againCounts[stage].delete(termIndex);
  if (stage === 'flashcards' && level !== 'done') ov.pace.needsPractice.add(termIndex);
  ov.pace.statuses[stage].set(termIndex, level);
  if (!auto) ov.pace.sortCount[stage] += 1;
  ov.pace.decision = null;
  ov.pace.sorting = false;
  if (auto) logEvent('auto-advance', { termIndex, stage });
  else logEvent('sort', { stage, termIndex, level, via });
  if (stage === 'flashcards') window.__base.sortFlashcard(level);
  else window.__base.sortLearnQuestion(level);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // The next card settles in from just below, for every sort. "Got it" used
    // to swap cards in a single frame.
    const nextCard = document.querySelector(stage === 'flashcards' ? '#app .flashcard' : '#app [data-question-card]');
    nextCard?.animate([
      { opacity: 0, transform: 'translate3d(0, 12px, 0) scale(.97)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
    ], { duration: 380, easing: 'cubic-bezier(.2, .9, .3, 1.06)' });
  }
  updatePaceMarker();
  checkPaceMessage();
}

/* -------------------------------------------------------------------- flow */

function enterExam() {
  logEvent('entry', { firstTap: !ov.entryTapped });
  ov.entryTapped = true;
  if (ov.suspended) { ov.sheet = 'resume'; render(); }
  else openSetup();
}

function resumeCorrectAnswer() {
  const learn = window.__base.state.learn;
  const question = learn.questions[learn.pos];
  if (!chapterOnePace() || ov.stage !== 'learn' || !question || learn.answer !== question.correct) return;
  clearTimeout(correctAdvanceTimer);
  correctAdvanceTimer = setTimeout(() => {
    if (chapterOnePace() && !ov.sheet && window.__base.state.learn.questions[learn.pos] === question) {
      sortPaceItem('done', 'button', document.querySelector('#app [data-question-card]'), { auto: true, bypassPrompt: true });
    }
  }, 800);
}

function openSetup() {
  ov.sheet = null;
  ov.spotlightDone = true;
  const prefilled = defaultDraft(clock.now());
  ov.setup = {
    step: 0,
    // The pre-filled time is the chosen time until the user changes it.
    examAt: prefilled,
    draftAt: prefilled,
    monthAnchor: prefilled,
    picker: null,
    selected: course.sets.map((_, index) => index),
    shaky: [],
    studyMinutes: null,
    error: null,
  };
  setPhase('setup');
  render();
}

function makePlan() {
  const now = clock.now();
  const study = chosenStudyMinutes(ov.setup, now);
  logEvent('study-time', {
    recommended: study.recommended,
    chosen: study.chosen,
    untilExam: study.untilExam,
    tight: study.tight,
  });
  setPhase('building');
  render();
  window.setTimeout(() => {
    if (ov.forcedPlanError) {
      ov.forcedPlanError = false;
      setPhase('plan-error');
      render();
      return;
    }
    ov.plan = Plan.createPlan({
      examAt: ov.setup.examAt,
      startedAt: clock.now(),
      sets: course.sets,
      selected: ov.setup.selected,
      shaky: ov.setup.shaky,
      studyMinutes: study.chosen,
    });
    logEvent('plan-built', {
      studyMinutes: ov.plan.studyMinutes,
      chapters: ov.plan.chapters.map((chapter) => ({ title: chapter.short, allotted: chapter.allotted, shaky: chapter.shaky })),
      finalReview: ov.plan.finalReview.allotted,
      tight: ov.plan.tight,
    });
    setPhase('plan');
    render();
  }, 1200);
}

function startSprint() {
  ov.pace = freshPace();
  ov.chapterIndex = 0;
  ov.stats.parkedSolved = 0;
  setPhase('study');
  startChapter(0);
}

function startChapter(index) {
  ov.chapterIndex = index;
  const chapter = ov.plan.chapters[index];
  chapter.status = 'active';
  chapter.used = 0;
  chapter.answered = 0;
  ov.chapterStartedAt = clock.now();
  ov.flashBonus = 0;
  ov.flashPrompted = false;
  ov.island = { state: 'compact', alert: null, message: '' };
  setPhase('study');
  const scope = Plan.termScope(course.sets[chapter.setIndex]);
  if (chapter.setIndex === 0) {
    ov.pace = freshPace();
    ov.pace.stageAt = clock.now();
  }
  if (chapter.stages.flashcards > 0) {
    ov.stage = 'flashcards';
    window.__base.startFlashcards(chapter.setIndex, scope);
  } else {
    ov.stage = 'learn';
    window.__base.startLearn(chapter.setIndex, scope);
  }
  logEvent('chapter-start', { chapter: chapter.short, allotted: chapter.allotted, stage: ov.stage });
  render();
}

/** Terms still to practise: the chapter's scope minus anything already parked. */
function learnScope(chapter) {
  return Plan.termScope(course.sets[chapter.setIndex]).filter(
    (index) => !chapter.parked.includes(index),
  );
}

function goToLearn() {
  const chapter = activeChapter();
  ov.stage = 'learn';
  if (chapter.setIndex === 0) {
    ov.pace.stageAt = clock.now();
    ov.pace.decision = null;
    ov.pace.toast = null;
    ov.pace.toastUntil = 0;
    ov.pace.lastMessage = '';
  }
  ov.island = { state: 'compact', alert: null, message: '' };
  const scope = learnScope(chapter);
  if (!scope.length) {
    // Everything got parked during Flashcards; go straight to the decision.
    logEvent('stage-change', { stage: 'learn', empty: true });
    showIslandAlert(parkedAlert(chapter.parked.length));
    return;
  }
  window.__base.startLearn(chapter.setIndex, scope);
  logEvent('stage-change', { stage: 'learn' });
  render();
}

function endChapter() {
  const chapter = activeChapter();
  // Learn can finish through more than one path; settle the chapter once.
  if (chapter.status === 'done') {
    setPhase('chapter-done');
    render();
    return;
  }
  const result = Plan.finishChapter(ov.plan, ov.chapterIndex);
  logEvent('chapter-end', { chapter: chapter.short, used: Math.round(chapter.used), result });
  ov.island = { state: 'compact', alert: null, message: '' };
  setPhase('chapter-done');
  render();
}

function continueAfterChapter() {
  const nextIndex = ov.plan.chapters.findIndex(
    (chapter, index) => index > ov.chapterIndex && chapter.status === 'upcoming',
  );
  if (nextIndex === -1) {
    startFinalReview();
    return;
  }
  startChapter(nextIndex);
}

function finalQuestions() {
  const grouped = Plan.missedAndParked(ov.plan);
  const questions = grouped.flatMap(({ chapter, termIndices }) =>
    window.__base.buildQuestions(course.sets[chapter.setIndex], termIndices).map((question) => ({
      ...question,
      setIndex: chapter.setIndex,
      parked: chapter.parked.includes(question.termIndex),
    })),
  );
  if (questions.length) return questions;
  // Nothing missed and nothing parked: review the first two terms of each set.
  return ov.plan.chapters
    .filter((chapter) => chapter.status !== 'skipped')
    .flatMap((chapter) =>
      window.__base.buildQuestions(course.sets[chapter.setIndex], [0, 1]).map((question) => ({
        ...question,
        setIndex: chapter.setIndex,
        parked: false,
      })),
    );
}

function startFinalReview() {
  ov.stage = 'review';
  ov.island = { state: 'compact', alert: null, message: '' };
  ov.chapterIndex = ov.plan.chapters.length - 1;
  ov.chapterStartedAt = clock.now();
  ov.plan.finalReview.used = 0;
  const questions = finalQuestions();
  setPhase('study');
  window.__base.startTest(ov.plan.chapters[0].setIndex, null, questions);
  logEvent('final-review-start', { questions: questions.length });
  render();
}

function sprintStats() {
  return {
    setsCovered: ov.plan ? ov.plan.chapters.filter((chapter) => chapter.status !== 'skipped').length : 0,
    minutes: ov.plan ? (clock.now() - ov.plan.startedAt) / 60000 : 0,
    parkedSolved: ov.stats.parkedSolved,
  };
}

/* ------------------------------------------------------------------ island */

function celebrate(message) {
  window.clearTimeout(celebrateTimer);
  ov.island = { state: 'celebrate', alert: null, message };
  celebrateTimer = window.setTimeout(() => {
    ov.island = { state: 'compact', alert: null, message: '' };
    updateIsland();
  }, 2000);
}

function showIslandAlert(alert) {
  window.clearTimeout(celebrateTimer);
  if (alert.level === 'ahead') celebrate(alert.message);
  else ov.island = { state: 'alert', alert, message: alert.message };
  logEvent('alert-shown', { level: alert.level, message: alert.message });
  render();
}

function resolveAlertAction(index) {
  const alert = ov.island.alert;
  if (!alert) return;
  const action = alert.actions[index];
  logEvent('alert-choice', { level: alert.level, choice: action.label });

  if (action.kind === 'park-current') {
    ov.island = { state: 'compact', alert: null, message: '' };
    const question = window.__base.state.learn.questions[window.__base.state.learn.pos];
    if (question) parkQuestion(question.termIndex, 'stuck-alert', question.chapterOrder);
    return;
  }

  if (action.kind === 'take') {
    const moved = Plan.addTime(ov.plan, ov.chapterIndex, 5, action.source);
    celebrate(`+${moved.minutes} min from ${moved.source}`);
  } else if (action.kind === 'work-parked') {
    workParkedNow();
    return;
  } else if (action.kind === 'defer-parked') {
    ov.island = { state: 'compact', alert: null, message: '' };
    endChapter();
    return;
  } else {
    ov.island = { state: 'compact', alert: null, message: '' };
  }
  activeChapter().alerted = true;
  render();
}

/**
 * Questions for parked terms, tagged with the chapter they came from. A saved
 * question can be answered inside a later chapter's round, so it has to carry
 * its own set and its own owner with it.
 */
function parkedQuestions(chapter, termIndices) {
  return window.__base
    .buildQuestions(course.sets[chapter.setIndex], termIndices)
    .map((question) => ({ ...question, chapterOrder: chapter.order, setIndex: chapter.setIndex }));
}

/** The term's own chapter, not whichever one happens to be active. */
function ownerChapter(question) {
  if (!ov.plan) return null;
  if (question && question.chapterOrder !== undefined) return ov.plan.chapters[question.chapterOrder];
  return activeChapter();
}

/** One saved question, brought back to the front of the round. */
function doParkedNow(chapterOrder, termIndex) {
  const chapter = ov.plan.chapters[chapterOrder];
  if (!chapter || !chapter.parked.includes(termIndex)) return;
  chapter.parked = chapter.parked.filter((value) => value !== termIndex);
  ov.sheet = null;
  logEvent('parked-resumed', { chapter: chapter.short, termIndex, count: 1 });

  if (ov.stage === 'review') {
    // It is already in the test queue; taking it out of the saved list is all
    // that is needed, and yanking the user into Learn would be worse.
    render();
    return;
  }
  window.__base.appendLearnQuestions(parkedQuestions(chapter, [termIndex]), { next: true });
  render();
}

/** Every saved question, from every chapter, worked as one block. */
function workParkedNow() {
  const pending = ov.plan.chapters
    .map((chapter) => ({ chapter, termIndices: [...chapter.parked] }))
    .filter((entry) => entry.termIndices.length);

  const count = pending.reduce((sum, entry) => sum + entry.termIndices.length, 0);
  ov.sheet = null;
  ov.island = { state: 'compact', alert: null, message: '' };

  if (!count || ov.stage === 'review') {
    render();
    return;
  }

  const questions = pending.flatMap(({ chapter, termIndices }) => {
    chapter.parked = [];
    return parkedQuestions(chapter, termIndices);
  });

  Plan.addTime(ov.plan, ov.chapterIndex, 5, 'final');
  logEvent('parked-worked', { count, chapters: pending.map((entry) => entry.chapter.short) });
  window.__base.appendLearnQuestions(questions, { next: true });
  render();
}

function parkQuestion(termIndex, via, chapterOrder) {
  const chapter =
    chapterOrder === undefined ? activeChapter() : ov.plan?.chapters[chapterOrder];
  if (!chapter || chapter.parked.includes(termIndex)) return;
  chapter.parked.push(termIndex);
  Plan.log(ov.plan, 'park', { chapter: chapter.short, termIndex, via });
  logEvent('park', { termIndex, via, stage: ov.stage });
  ov.island = { state: 'compact', alert: null, message: '' };
  islandNode?.classList.add('is-catching');
  window.setTimeout(() => islandNode?.classList.remove('is-catching'), 420);
  if (ov.stage === 'flashcards') window.__base.removeFlashcard(termIndex);
  else window.__base.removeLearnQuestion(termIndex);
  render();
}

/* ------------------------------------------------------------------- ticks */

function tick() {
  if (!sprintRunning()) {
    updateIsland();
    return;
  }
  const chapter = activeChapter();
  if (!chapter) return;

  if (ov.stage === 'review') {
    ov.plan.finalReview.used = (clock.now() - ov.chapterStartedAt) / 60000;
  } else {
    chapter.used = (clock.now() - ov.chapterStartedAt) / 60000;
  }

  if (chapterOnePace()) {
    updatePaceMarker();
    return;
  }

  if (ov.stage === 'flashcards' && !ov.flashPrompted) {
    const limit = Plan.stageMinutes(chapter, 'flashcards') + ov.flashBonus;
    if (chapter.used >= limit) {
      ov.flashPrompted = true;
      showIslandAlert({
        level: 'stage',
        message: 'Time to practice',
        actions: [
          { label: 'Go to Learn', kind: 'go-learn' },
          { label: '1 more min', kind: 'more-flash' },
        ],
        primaryFirst: true,
      });
      return;
    }
  }

  if (ov.stage === 'learn' && ov.island.state !== 'alert') {
    const suggestion = Plan.paceCheck(ov.plan, ov.chapterIndex);
    if (suggestion && suggestion.level === 'mild') {
      chapter.alerted = true;
      showIslandAlert(mildAlert(suggestion));
      return;
    }
    if (suggestion && suggestion.level === 'severe') {
      ov.severe = suggestion;
      ov.plan.severeShown = true;
      chapter.alerted = true;
      ov.island = { state: 'compact', alert: null, message: '' };
      ov.sheet = 'severe';
      logEvent('alert-shown', { level: 'severe' });
      render();
      return;
    }
  }

  updateIsland();
}

/* ------------------------------------------------------------------- donut */

function focusSlice(key, source) {
  const donut = root.querySelector('[data-donut]');
  if (!donut || donut.dataset.focus === key) return;
  donut.dataset.focus = key;
  donut.querySelectorAll('.ov-donut-arc').forEach((arc) => {
    arc.classList.toggle('is-focus', arc.dataset.slice === key);
    arc.classList.toggle('is-dim', arc.dataset.slice !== key);
  });
  donut.querySelectorAll('.ov-donut-key').forEach((entry) => {
    entry.classList.toggle('is-focus', entry.dataset.slice === key);
  });
  donut.querySelectorAll('.ov-donut-readout').forEach((readout) => {
    readout.classList.toggle('is-active', readout.dataset.readout === key);
  });
  logEvent('plan-slice', { slice: key, via: source });
}

/* ------------------------------------------------------------------ events */

/**
 * The adjust sheet stays mounted while open, so values are written back in
 * place. Every field is refreshed, not just the edited one, because moving
 * time always changes Final review too.
 */
function syncAdjustSheet() {
  ov.plan.chapters.forEach((chapter) => {
    const input = root.querySelector(`[data-adjust-input="${chapter.order}"]`);
    if (input && document.activeElement !== input) input.value = String(chapter.allotted);
  });
  const finalValue = root.querySelector('[data-adjust-final]');
  if (finalValue) finalValue.textContent = `${ov.plan.finalReview.allotted} min`;
}

/** A typed number is a request; the plan decides what it can actually give. */
function commitAdjustInput(input) {
  const index = Number(input.dataset.adjustInput);
  const chapter = ov.plan?.chapters[index];
  if (!chapter) return;
  const wanted = Math.round(Number(input.value));
  if (Number.isFinite(wanted) && wanted !== chapter.allotted) {
    Plan.adjustChapter(ov.plan, index, Math.max(1, wanted) - chapter.allotted);
    logEvent('adjust-typed', { chapter: chapter.short, wanted, allotted: chapter.allotted });
  }
  // Show what really happened, e.g. capped by what Final review had left.
  input.value = String(chapter.allotted);
  syncAdjustSheet();
}

function onOverlayClick(event) {
  if (Date.now() < suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const paceChoice = event.target.closest('[data-pace-decision]');
  if (paceChoice && ov.pace.decision) {
    const { stage, termIndex } = ov.pace.decision;
    const level = paceChoice.dataset.paceDecision;
    logEvent('stuck-prompt-choice', { stage, termIndex, choice: level === 'later' ? 'Move it later' : 'Keep it close' });
    const card = document.querySelector(stage === 'flashcards' ? '#app .sprint-sort-stage' : '#app .sprint-question-sort');
    sortPaceItem(level, 'button', card, { bypassPrompt: true });
    return;
  }

  const target = event.target.closest('[data-ov]');

  // Tap anywhere outside an expanded island collapses it.
  if (ov.island.state === 'expanded' && !event.target.closest('.ov-island')) {
    ov.island.state = 'compact';
    logEvent('island-toggle', { state: 'compact', via: 'outside' });
    render();
  }

  if (!target) return;
  const action = target.dataset.ov;

  // The coach mark is a one-liner: any interaction retires it, for good.
  if (sprintRunning() && ov.stage === 'learn') ov.coachShown = true;

  const handlers = {
    'keep-session': () => { logEvent('leave-prompt', { choice: 'keep' }); ov.sheet = null; render(); resumeCorrectAnswer(); },
    'leave-session': () => {
      logEvent('leave-prompt', { choice: 'leave' });
      ov.suspended = { route: window.__base.state.route, phase: ov.phase, speed: clock.speed };
      clock.setSpeed(0);
      clearTimeout(correctAdvanceTimer);
      ov.sheet = null;
      setPhase('idle');
      window.__base.go('folder');
      render();
    },
    'continue-session': () => {
      logEvent('resume-prompt', { choice: 'continue' });
      const saved = ov.suspended;
      if (!saved) return;
      ov.suspended = null; ov.sheet = null;
      setPhase(saved.phase);
      clock.setSpeed(saved.speed);
      window.__base.go(saved.route);
      render(); resumeCorrectAnswer();
    },
    'restart-session': () => {
      logEvent('resume-prompt', { choice: 'restart' });
      ov.suspended = null; ov.plan = null; ov.pace = freshPace();
      clock.reset();
      openSetup();
    },
    'plan-my-time': () => {
      logEvent('plan-my-time', { from: window.__base.state.route });
      enterExam();
    },
    'study-all': () => {
      enterExam();
    },
    'prep-exam': () => {
      enterExam();
    },
    'dismiss-sheet': () => {
      const wasLeave = ov.sheet === 'leave';
      if (wasLeave) logEvent('leave-prompt', { choice: 'keep' });
      ov.sheet = null;
      render();
      if (wasLeave) resumeCorrectAnswer();
    },
    'cancel-setup': () => {
      setPhase('idle');
      ov.spotlightDone = true;
      window.__base.reset();
      render();
    },
    'open-picker': () => {
      const which = target.dataset.picker;
      ov.setup.picker = ov.setup.picker === which ? null : which;
      if (!ov.setup.draftAt) ov.setup.draftAt = defaultDraft(clock.now());
      if (!ov.setup.monthAnchor) ov.setup.monthAnchor = ov.setup.draftAt;
      logEvent('picker-open', { picker: ov.setup.picker });
      render();
    },
    'shift-month': () => {
      ov.setup.monthAnchor = shiftMonth(ov.setup.monthAnchor ?? clock.now(), Number(target.dataset.delta));
      render();
    },
    'pick-day': () => commitDraft(withDay(currentDraft(), Number(target.dataset.day))),
    'pick-hour': () => commitDraft(withHour(currentDraft(), Number(target.dataset.hour))),
    'pick-minute': () => commitDraft(withMinute(currentDraft(), Number(target.dataset.minute))),
    'pick-meridiem': () => commitDraft(withMeridiem(currentDraft(), target.dataset.meridiem)),
    'toggle-chapter': () => {
      const index = Number(target.dataset.chapter);
      if (index === 0) return;
      ov.setup.selected = ov.setup.selected.includes(index)
        ? ov.setup.selected.filter((value) => value !== index)
        : [...ov.setup.selected, index].sort((a, b) => a - b);
      render();
    },
    'toggle-shaky': () => {
      const index = Number(target.dataset.chapter);
      ov.setup.shaky = ov.setup.shaky.includes(index)
        ? ov.setup.shaky.filter((value) => value !== index)
        : [...ov.setup.shaky, index];
      logEvent('shaky-toggle', { chapter: index, on: ov.setup.shaky.includes(index) });
      render();
    },
    'setup-next': () => {
      if (!ov.setup.examAt || ov.setup.examAt <= clock.now() || !ov.setup.selected.length) return;
      ov.setup.step = Math.min(3, (ov.setup.step || 0) + 1);
      ov.setup.picker = null;
      render();
    },
    'setup-back': () => { ov.setup.step = Math.max(0, (ov.setup.step || 0) - 1); render(); },
    'study-recommended': () => {
      ov.setup.studyMinutes = null;
      render();
    },
    'make-plan': () => makePlan(),
    'retry-plan': () => makePlan(),
    'back-to-setup': () => {
      setPhase('setup');
      render();
    },
    'donut-slice': () => focusSlice(target.dataset.slice, 'legend'),
    'start-sprint': () => {
      logEvent('plan-accepted', { total: Plan.totalAllotted(ov.plan) });
      setPhase('pace-intro'); render();
    },
    'intro-back': () => { setPhase('plan'); render(); },
    'begin-study': () => {
      startSprint();
      ov.pace.hintsSeen.pace = true;
      document.querySelector('#app .sprint-pace-intro')?.remove();
    },
    'open-adjust': () => {
      ov.sheet = 'adjust';
      logEvent('adjust-open');
      render();
    },
    adjust: () => {
      Plan.adjustChapter(ov.plan, Number(target.dataset.chapter), Number(target.dataset.delta));
      syncAdjustSheet();
    },
    'island-toggle': () => {
      if (ov.island.state === 'alert') return;
      ov.island.state = ov.island.state === 'expanded' ? 'compact' : 'expanded';
      logEvent('island-toggle', { state: ov.island.state });
      render();
    },
    'alert-action': () => {
      const index = Number(target.dataset.index);
      const alert = ov.island.alert;
      if (alert && alert.level === 'stage') {
        logEvent('alert-choice', { level: 'stage', choice: alert.actions[index].label });
        if (alert.actions[index].kind === 'go-learn') {
          goToLearn();
        } else {
          ov.flashBonus += 1;
          ov.flashPrompted = false;
          ov.island = { state: 'compact', alert: null, message: '' };
          render();
        }
        return;
      }
      resolveAlertAction(index);
    },
    'open-parked': () => {
      ov.sheet = 'parked';
      logEvent('parked-sheet-open', { via: 'button' });
      render();
    },
    'add-time': () => {
      showIslandAlert(addTimeAlert(ov.plan, ov.chapterIndex));
    },
    unpark: () => doParkedNow(Number(target.dataset.chapter), Number(target.dataset.term)),
    'work-parked': () => workParkedNow(),
    'severe-accept': () => {
      Plan.applySevere(ov.plan, ov.severe);
      logEvent('alert-choice', { level: 'severe', choice: 'Use suggestion' });
      ov.sheet = null;
      ov.severe = null;
      render();
    },
    'severe-decide': () => {
      logEvent('alert-choice', { level: 'severe', choice: 'I’ll decide' });
      ov.sheet = 'adjust';
      render();
    },
    'next-chapter': () => continueAfterChapter(),
    'go-learn': () => goToLearn(),
    'finish-sprint': () => {
      logEvent('sprint-finished', sprintStats());
      setPhase('idle');
      ov.plan = null;
      ov.spotlightDone = true;
      window.__base.reset();
      render();
    },
    'park-button': () => {
      const owner = target.dataset.chapter === undefined ? undefined : Number(target.dataset.chapter);
      parkQuestion(Number(target.dataset.term), 'button', owner);
    },
    'review-card': () => {
      ov.reviewTerm = { setIndex: Number(target.dataset.set), termIndex: Number(target.dataset.term) };
      ov.sheet = 'review';
      logEvent('review-card-open', { termIndex: ov.reviewTerm.termIndex });
      render();
    },
    'dbg-toggle': () => {
      ov.debugOpen = !ov.debugOpen;
      render();
    },
    'dbg-close': () => {
      ov.debugOpen = false;
      render();
    },
    'dbg-mode': () => setMode(target.dataset.value),
    'dbg-time': () => {
      clock.advance(Number(target.dataset.value));
      tick();
      render();
    },
    'dbg-speed': () => {
      clock.setSpeed(Number(target.dataset.value));
      render();
    },
    'dbg-jump': () => debugJump(target.dataset.target, Number(target.dataset.index)),
    'dbg-trigger': () => debugTrigger(target.dataset.value),
    'dbg-reset': () => resetAll(),
    'dbg-export': () => exportLog(),
  };

  const handler = handlers[action];
  if (handler) {
    event.preventDefault();
    handler();
  }
}

function onOverlayHover(event) {
  const arc = event.target.closest('.ov-donut-arc');
  if (arc) focusSlice(arc.dataset.slice, 'hover');
}

function currentDraft() {
  return ov.setup.examAt ?? ov.setup.draftAt ?? defaultDraft(clock.now());
}

/** Every pick recomputes the exam time and the "time you have left" line. */
function commitDraft(next) {
  ov.setup.draftAt = next;
  ov.setup.monthAnchor = next;
  if (next <= clock.now()) {
    ov.setup.error = 'That time has already passed.';
    ov.setup.examAt = null;
  } else {
    ov.setup.error = null;
    ov.setup.examAt = next;
  }
  logEvent('exam-time-picked', { at: new Date(next).toISOString(), error: ov.setup.error });
  render();
}


/* --------------------------------------------------------- study time step */

let studyDrag = null;

function studyBounds(track) {
  return { scale: Number(track.dataset.scale), min: Number(track.dataset.min), max: Number(track.dataset.max) };
}

/** Moves the bar and the digits live while dragging, without a re-render. */
function previewStudy(track, minutes) {
  const { scale } = studyBounds(track);
  track.style.setProperty('--study-fill', `${Math.min(100, (minutes / scale) * 100)}%`);
  const card = track.closest('.ov-study-card');
  card.querySelector('[data-study-input="hours"]').value = String(Math.floor(minutes / 60));
  card.querySelector('[data-study-input="minutes"]').value = String(minutes % 60).padStart(2, '0');
}

function minutesAt(track, clientX) {
  const { scale, min, max } = studyBounds(track);
  const rect = track.querySelector('.ov-study-usable').getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
  const snapped = Math.round((fraction * scale) / 15) * 15;
  return Math.max(min, Math.min(max, snapped));
}

function commitStudy(minutes, via) {
  ov.setup.studyMinutes = minutes;
  logEvent('study-time-change', { minutes, via });
  render();
}

function attachStudyControls() {
  root.addEventListener('pointerdown', (event) => {
    const track = event.target.closest('[data-study-track]');
    if (!track) return;
    event.preventDefault();
    try {
      track.setPointerCapture?.(event.pointerId);
    } catch {
      /* Capture is a nicety; the drag still tracks without it. */
    }
    track.classList.add('is-dragging');
    studyDrag = { track, pointerId: event.pointerId, minutes: minutesAt(track, event.clientX) };
    previewStudy(track, studyDrag.minutes);
  });
  root.addEventListener('pointermove', (event) => {
    if (!studyDrag || event.pointerId !== studyDrag.pointerId) return;
    studyDrag.minutes = minutesAt(studyDrag.track, event.clientX);
    previewStudy(studyDrag.track, studyDrag.minutes);
  });
  const end = (event) => {
    if (!studyDrag || event.pointerId !== studyDrag.pointerId) return;
    const { minutes } = studyDrag;
    studyDrag = null;
    commitStudy(minutes, 'drag');
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  // Typing in the time box: hours and minutes are read together.
  root.addEventListener('change', (event) => {
    const input = event.target.closest('[data-study-input]');
    if (!input) return;
    const card = input.closest('.ov-study-card');
    const hours = Math.max(0, Math.round(Number(card.querySelector('[data-study-input="hours"]').value) || 0));
    const mins = Math.max(0, Math.round(Number(card.querySelector('[data-study-input="minutes"]').value) || 0));
    const { min, max } = chosenStudyMinutes(ov.setup, clock.now());
    commitStudy(Math.max(min, Math.min(max, hours * 60 + mins)), 'typed');
  });
  root.addEventListener('keydown', (event) => {
    if (event.target.closest('[data-study-input]') && event.key === 'Enter') event.target.blur();
    const thumb = event.target.closest('.ov-study-thumb');
    if (!thumb) return;
    const delta = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const { min, max } = studyBounds(thumb.closest('[data-study-track]'));
    const { chosen } = chosenStudyMinutes(ov.setup, clock.now());
    commitStudy(Math.max(min, Math.min(max, chosen + delta)), 'keys');
    root.querySelector('.ov-study-thumb')?.focus();
  });
  root.addEventListener('focusin', (event) => {
    event.target.closest('[data-study-input]')?.select();
  });
}

/* ---------------------------------------------------------------- gestures */

function attachIslandGestures(wrap) {
  let startY = null;
  wrap.addEventListener('pointerdown', (event) => {
    startY = event.clientY;
  });
  // The pointer leaves the island before it is released, so the release is
  // caught on the document rather than on the island itself.
  document.addEventListener('pointerup', (event) => {
    if (startY === null) return;
    const distance = event.clientY - startY;
    startY = null;
    if (distance > 24) {
      ov.sheet = 'parked';
      logEvent('parked-sheet-open', { via: 'pull-down' });
      render();
    }
  });
  document.addEventListener('pointercancel', () => {
    startY = null;
  });
}

const PARK_THRESHOLD = 60;
const PARK_SLOP = 8;

/** The card the sprint can park right now, and the term it stands for. */
function parkTarget(node) {
  if (ov.stage === 'learn' && node.matches('[data-question-card]')) {
    const question = window.__base.state.learn.questions[window.__base.state.learn.pos];
    return question
      ? { termIndex: question.termIndex, kind: 'learn', chapterOrder: question.chapterOrder }
      : null;
  }
  if (ov.stage === 'flashcards' && node.matches('[data-swipe-stage]')) {
    return { termIndex: window.__base.state.cardIndex, kind: 'flashcard' };
  }
  return null;
}

/** Ties the drag to the island: 0 is untouched, 1 is far enough to save. */
function setCatchProgress(progress) {
  if (!islandNode) return;
  const clamped = Math.max(0, Math.min(1, progress));
  islandNode.style.setProperty('--catch', clamped.toFixed(3));
  islandNode.classList.toggle('is-ready', clamped >= 1);
}

function clearCatchProgress() {
  if (!islandNode) return;
  islandNode.style.removeProperty('--catch');
  islandNode.classList.remove('is-ready');
}

function attachParkGestures() {
  const app = document.querySelector('#app');
  let start = null;
  let node = null;
  let pointerId = null;
  let captured = false;

  const reset = () => {
    clearCatchProgress();
    if (node) {
      node.classList.remove('is-dragging-up', 'is-ready-to-park');
      node.style.removeProperty('--park-y');
      node.style.removeProperty('--park-p');
      try {
        if (captured && pointerId !== null && node.hasPointerCapture?.(pointerId)) {
          node.releasePointerCapture(pointerId);
        }
      } catch {
        /* Already released. */
      }
    }
    start = null;
    node = null;
    pointerId = null;
    captured = false;
  };

  app.addEventListener('pointerdown', (event) => {
    if (!sprintRunning()) return;
    if (chapterOnePace()) return;
    const card = event.target.closest('[data-question-card], [data-swipe-stage]');
    if (!card || !parkTarget(card)) return;
    node = card;
    start = { x: event.clientX, y: event.clientY };
    pointerId = event.pointerId;
    captured = false;
  });

  app.addEventListener('pointermove', (event) => {
    if (!start || !node) return;
    const dy = event.clientY - start.y;
    const dx = event.clientX - start.x;
    const vertical = dy < -PARK_SLOP && Math.abs(dy) > Math.abs(dx);

    if (vertical && !captured) {
      // Capture only once this is clearly a swipe. Capturing on pointerdown
      // would retarget the following click to the card, which swallowed every
      // tap on an answer. Capture is an optimisation, not a requirement, so a
      // refusal must not abort the gesture.
      try {
        node.setPointerCapture?.(event.pointerId);
      } catch {
        /* Pointer already gone; the gesture still tracks fine without it. */
      }
      captured = true;
    }

    if (!captured) return;
    if (vertical) {
      node.classList.add('is-dragging-up');
      // Rubber-banding past the threshold, so the card feels like it catches.
      const pull = dy < -PARK_THRESHOLD ? -PARK_THRESHOLD + (dy + PARK_THRESHOLD) / 3 : dy;
      const progress = Math.min(1, -dy / PARK_THRESHOLD);
      node.style.setProperty('--park-y', `${pull}px`);
      node.style.setProperty('--park-p', progress.toFixed(3));
      node.classList.toggle('is-ready-to-park', dy < -PARK_THRESHOLD);
      setCatchProgress(progress);
    } else {
      node.style.setProperty('--park-y', '0px');
      node.style.setProperty('--park-p', '0');
      node.classList.remove('is-ready-to-park');
      setCatchProgress(0);
    }
  });

  app.addEventListener('pointerup', (event) => {
    if (!start || !node) return;
    const dy = event.clientY - start.y;
    const dx = event.clientX - start.x;
    const card = node;
    const target = parkTarget(card);
    const parking = captured && dy < -PARK_THRESHOLD && Math.abs(dy) > Math.abs(dx) && target;
    reset();
    if (!parking) return;
    // A swipe must not also count as a tap on whatever was under the finger.
    suppressClickUntil = Date.now() + 500;
    setCatchProgress(1);
    card.classList.add('is-parking');
    window.setTimeout(() => {
      clearCatchProgress();
      parkQuestion(target.termIndex, 'swipe');
    }, 300);
  });

  app.addEventListener('pointercancel', reset);
  // However a gesture ends - released off the card, cancelled by the browser,
  // interrupted by a re-render - the island must not stay mid-catch.
  document.addEventListener('pointerup', clearCatchProgress);
  document.addEventListener('pointercancel', clearCatchProgress);
  window.addEventListener('blur', clearCatchProgress);

  // Runs before the base's own click handler, so a swipe never answers.
  app.addEventListener(
    'click',
    (event) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
}

function attachDebugTap() {
  let taps = [];
  document.addEventListener('pointerdown', (event) => {
    if (event.clientY > 48) return;
    if (event.target.closest('#ov-root')) return;
    const now = Date.now();
    taps = taps.filter((value) => now - value < 600);
    taps.push(now);
    if (taps.length >= 3) {
      taps = [];
      ov.debugOpen = !ov.debugOpen;
      render();
    }
  });
}

/* ------------------------------------------------------------------- debug */

function ensurePlan() {
  if (ov.plan) return;
  const examAt = clock.now() + 6 * 60 * 60000;
  ov.setup = {
    examAt,
    draftAt: examAt,
    monthAnchor: examAt,
    picker: null,
    selected: course.sets.map((_, index) => index),
    shaky: [],
    error: null,
  };
  ov.plan = Plan.createPlan({
    examAt,
    startedAt: clock.now(),
    sets: course.sets,
    selected: ov.setup.selected,
    shaky: ov.setup.shaky,
  });
}

function debugJump(targetName, index) {
  logEvent('debug-jump', { target: targetName, index });
  if (targetName === 'setup') {
    openSetup();
    return;
  }
  ensurePlan();
  if (targetName === 'plan') {
    setPhase('plan');
    render();
    return;
  }
  if (targetName === 'chapter') {
    ov.plan.chapters.forEach((chapter, position) => {
      chapter.status = position < index ? 'done' : 'upcoming';
    });
    startChapter(index);
    return;
  }
  if (targetName === 'done-ahead' || targetName === 'done-over') {
    const chapter = ov.plan.chapters[Math.min(1, ov.plan.chapters.length - 1)];
    ov.chapterIndex = chapter.order;
    chapter.status = 'active';
    chapter.used = targetName === 'done-ahead' ? chapter.allotted - 6 : chapter.allotted + 4;
    chapter.answered = chapter.total;
    endChapter();
    return;
  }
  if (targetName === 'final') {
    ov.plan.chapters.forEach((chapter) => {
      if (chapter.status === 'skipped') return;
      chapter.status = 'done';
      if (!Object.keys(chapter.missed).length) chapter.missed = { 0: 1, 2: 1 };
    });
    startFinalReview();
    return;
  }
  if (targetName === 'sprint-done') {
    ov.plan.chapters.forEach((chapter) => {
      if (chapter.status !== 'skipped') chapter.status = 'done';
    });
    ov.stats.parkedSolved = ov.stats.parkedSolved || 3;
    setPhase('sprint-done');
    render();
  }
}

function debugTrigger(kind) {
  logEvent('debug-trigger', { kind });
  if (kind === 'plan-error') {
    ov.forcedPlanError = true;
    if (ov.phase === 'setup') return;
    openSetup();
    return;
  }
  ensurePlan();
  if (ov.phase !== 'study') {
    startChapter(Math.min(1, ov.plan.chapters.length - 1));
    ov.stage = 'learn';
    const active = activeChapter();
    window.__base.startLearn(active.setIndex, Plan.termScope(course.sets[active.setIndex]));
  }
  const chapter = activeChapter();
  chapter.answered = Math.max(1, Math.round(chapter.total * 0.5));
  if (kind === 'mild') {
    chapter.used = chapter.allotted * 0.75;
    showIslandAlert(
      mildAlert({
        chapter,
        overrun: 8,
        donors: ov.plan.chapters.filter((entry) => entry.order > chapter.order),
      }),
    );
  }
  if (kind === 'severe') {
    const upcoming = ov.plan.chapters.filter((entry) => entry.order > chapter.order);
    const victim = upcoming[upcoming.length - 1] || chapter;
    ov.severe = { chapter, overrun: 30, victim, receivers: upcoming.slice(0, -1) };
    ov.island = { state: 'compact', alert: null, message: '' };
    ov.sheet = 'severe';
    render();
  }
}

function exportLog() {
  const payload = {
    exportedAt: new Date().toISOString(),
    mode: ov.mode,
    plan: ov.plan
      ? {
          examAt: new Date(ov.plan.examAt).toISOString(),
          startedAt: new Date(ov.plan.startedAt).toISOString(),
          chapters: ov.plan.chapters.map((chapter) => ({
            title: chapter.short,
            shaky: chapter.shaky,
            allotted: chapter.allotted,
            used: Math.round(chapter.used),
            status: chapter.status,
            parked: chapter.parked,
            missed: chapter.missed,
          })),
          finalReview: ov.plan.finalReview,
          reallocations: ov.plan.log,
        }
      : null,
    events: ov.log,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `exam-sprint-session-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetAll() {
  ov.suspended = null;
  ov.entryTapped = false;
  clock.reset();
  ov.plan = null;
  ov.pace = freshPace();
  ov.sheet = null;
  ov.severe = null;
  ov.island = { state: 'compact', alert: null, message: '' };
  ov.coachShown = false;
  ov.spotlightDone = false;
  ov.stats = { parkedSolved: 0 };
  ov.log = [];
  setPhase('idle');
  window.__base.reset();
  if (ov.demo) { openSetup(); return; }
  render();
}

/* -------------------------------------------------------------------- mode */

const sprintHooks = {
  stableLearnLayout: () => chapterOnePace() && ov.stage === 'learn',
  interceptSwipe() {
    return chapterOnePace() && ov.stage === 'flashcards';
  },
  interceptClick(event) {
    if (ov.mode !== 'sprint') return false;

    const studyAll = event.target.closest('.sticky-action button');
    if (studyAll && window.__base.state.route === 'folder') {
      enterExam();
      return true;
    }

    // Closing a study screen steps out of the sprint but keeps the plan, so
    // the island can offer to resume instead of vanishing.
    if (sprintRunning() && event.target.closest('.app-header .icon-button[data-nav]')) {
      if (ov.pace.sorting) return true;
      clearTimeout(correctAdvanceTimer);
      ov.sheet = 'leave';
      render();
      return true;
    }
    const entry = event.target.closest('[data-open-set], [data-nav="flashcards"], [data-nav="quiz"]');
    if (entry) {
      if (entry.dataset.openSet === undefined || Number(entry.dataset.openSet) === 0) enterExam();
      return true;
    }
    if (event.target.closest('[data-nav="test-setup"], [data-nav="test"]')) return true;
    return false;
  },

  afterRender() {
    if (ov.mode !== 'sprint') return;
    enhanceEntry();
    if (chapterOnePace()) {
      enhancePaceScreen();
      document.documentElement.dataset.sprintActive = 'false';
      document.documentElement.dataset.spotlight = 'false';
      updateIsland();
      return;
    }
    if (sprintRunning() && ov.stage === 'learn' && !ov.coachShown) {
      const section = document.querySelector('[data-question-card]');
      if (section) {
        const coach = document.createElement('p');
        coach.className = 'ov-coach';
        coach.innerHTML = `${saveGlyph('ov-glyph-sm')}<span>Don’t know one? Swipe the question up to save it for later.</span>`;
        section.insertBefore(coach, section.firstChild);
      }
    }
    document.documentElement.dataset.sprintActive = islandVisible() ? 'true' : 'false';
    document.documentElement.dataset.spotlight = spotlightVisible() ? 'true' : 'false';
    updateIsland();
  },

  learnExtras({ question, answered }) {
    if (!sprintRunning()) return '';
    if (chapterOnePace()) return '';
    const chapter = activeChapter();
    if (!chapter) return '';
    const owner = ownerChapter(question) || chapter;
    const misses = owner.missed[question.termIndex] || 0;

    if (!answered) {
      return `<div class="ov-learn-extras">
        <button class="ov-text-button ov-save-later" data-ov="park-button" data-term="${question.termIndex}" data-chapter="${owner.order}">
          ${saveGlyph('ov-glyph-sm')}Save for later
        </button>
      </div>`;
    }

    // After a miss the prompt gets louder: this is the moment parking is for.
    const urgent = misses >= 1;
    return `<div class="ov-learn-extras">
      <button class="ov-text-button ov-save-later${urgent ? ' is-urgent' : ''}" data-ov="park-button" data-term="${question.termIndex}" data-chapter="${owner.order}">
        ${saveGlyph('ov-glyph-sm')}${urgent ? 'Save it for later' : 'Save for later'}
      </button>
      ${
        misses >= 2
          ? `<button class="ov-text-button ov-review-link" data-ov="review-card" data-set="${owner.setIndex}" data-term="${question.termIndex}">Review this card</button>`
          : ''
      }
    </div>`;
  },

  onLearnAnswer({ question, correct }) {
    if (ov.mode !== 'sprint') return;
    const active = activeChapter();
    if (!active) return;
    if (chapterOnePace()) {
      active.answered += 1;
      if (!correct) active.missed[question.termIndex] = (active.missed[question.termIndex] || 0) + 1;
      logEvent('learn-answer', { termIndex: question.termIndex, correct, from: active.short });
      if (correct) {
        window.clearTimeout(correctAdvanceTimer);
        correctAdvanceTimer = window.setTimeout(() => {
          const learn = window.__base.state.learn;
          if (!chapterOnePace() || ov.sheet || ov.stage !== 'learn' || learn.questions[learn.pos] !== question || learn.answer !== question.correct) return;
          sortPaceItem('done', 'button', document.querySelector('#app [data-question-card]'), { auto: true, bypassPrompt: true });
        }, 800);
      }
      return;
    }
    // Pace is about the chapter whose budget is running; mastery belongs to
    // the chapter the term came from, which can differ for a resumed save.
    const owner = ownerChapter(question) || active;
    ov.coachShown = true;
    active.answered += 1;
    if (!correct) owner.missed[question.termIndex] = (owner.missed[question.termIndex] || 0) + 1;
    logEvent('learn-answer', {
      termIndex: question.termIndex,
      correct,
      hard: Boolean(question.hard),
      from: owner.short,
    });

    // Two misses on one term: the island steps in and names the cost.
    const misses = owner.missed[question.termIndex] || 0;
    if (!correct && misses >= 2 && !owner.stuckShown.includes(question.termIndex)) {
      owner.stuckShown.push(question.termIndex);
      showIslandAlert(stuckAlert(question.term));
    }
  },

  onFlashComplete() {
    if (ov.mode !== 'sprint' || !ov.plan || ov.phase !== 'study') return false;
    if (chapterOnePace()) {
      ov.stage = 'transition';
      logEvent('stage-change', { stage: 'transition' });
      return true;
    }
    goToLearn();
    return true;
  },

  onLearnComplete() {
    if (ov.mode !== 'sprint' || !ov.plan || ov.phase !== 'study') return false;
    if (chapterOnePace()) {
      endChapter();
      return true;
    }
    const chapter = activeChapter();
    if (chapter.parked.length) {
      showIslandAlert(parkedAlert(chapter.parked.length));
      return true;
    }
    endChapter();
    return true;
  },

  onTestAnswer({ question, correct }) {
    if (ov.mode !== 'sprint' || ov.stage !== 'review') return;
    if (correct && question.parked) ov.stats.parkedSolved += 1;
    logEvent('review-answer', { termIndex: question.termIndex, correct, parked: Boolean(question.parked) });
  },

  onTestComplete() {
    if (ov.mode !== 'sprint' || ov.stage !== 'review') return false;
    setPhase('sprint-done');
    render();
    return true;
  },
};

function setMode(mode) {
  window.clearTimeout(correctAdvanceTimer);
  ov.mode = mode;
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  window.history.replaceState({}, '', url);

  if (mode === 'sprint') {
    setHooks(sprintHooks);
    if (!unsubscribeClock) unsubscribeClock = clock.subscribe(tick);
  } else {
    clearHooks();
    unsubscribeClock?.();
    unsubscribeClock = null;
  }

  ov.plan = null;
  ov.pace = freshPace();
  ov.sheet = null;
  ov.spotlightDone = false;
  ov.island = { state: 'compact', alert: null, message: '' };
  setPhase('idle');
  logEvent('mode', { mode });
  ov.suspended = null;
  ov.entryTapped = false;
  clock.reset();
  window.__base.reset();
  render();
}

/* -------------------------------------------------------------------- boot */

function boot() {
  if (ov.demo) document.title = 'Demo · Animal Facts';
  injectStyles();
  buildRoot();
  document.addEventListener('click', onOverlayClick);
  root.addEventListener('input', (event) => {
    const input = event.target.closest('[data-stage-split]');
    if (!input || !ov.plan) return;
    const chapter = ov.plan.chapters.find(chapter => chapter.order === Number(input.dataset.stageSplit));
    if (!chapter) return;
    const fraction = Number(input.value) / 100;
    chapter.stages = { flashcards: fraction, learn: 1 - fraction };
    const minutes = Math.round(chapter.allotted * fraction);
    input.style.setProperty('--split', `${input.value}%`);
    input.setAttribute('aria-valuetext', `${minutes} minutes flashcards, ${chapter.allotted - minutes} minutes quiz`);
    const card = input.closest('[data-split-card]');
    card.querySelector('[data-flash-minutes]').textContent = `${minutes} min`;
    card.querySelector('[data-quiz-minutes]').textContent = `${chapter.allotted - minutes} min`;
  });
  root.addEventListener('pointerover', onOverlayHover);
  attachStudyControls();
  root.addEventListener('change', (event) => {
    const input = event.target.closest('[data-adjust-input]');
    if (input) commitAdjustInput(input);
  });
  root.addEventListener('keydown', (event) => {
    const input = event.target.closest('[data-adjust-input]');
    if (input && event.key === 'Enter') input.blur();
  });
  // Select the whole number on focus, so typing replaces it.
  root.addEventListener('focusin', (event) => {
    event.target.closest('[data-adjust-input]')?.select();
  });
  attachParkGestures();
  attachDebugTap();
  if (ov.mode === 'sprint') {
    setHooks(sprintHooks);
    unsubscribeClock = clock.subscribe(tick);
  }
  render();
  window.__sprint = { ov, clock, Plan, setMode, exportLog, render };
  if (ov.demo) openSetup();
}

if (window.__base) boot();
else window.addEventListener('DOMContentLoaded', boot, { once: true });

export { formatClockTime, formatDuration };
