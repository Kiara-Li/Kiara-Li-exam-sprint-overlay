// Exam Sprint overlay.
// Renders on top of the base reproduction and never modifies it: everything
// it needs from the base arrives through base/extensions.js hooks and the
// window.__base API. In `original` mode the hooks are cleared and this layer
// is inert.

import { course } from '../base/data.js';
import { clearHooks, setHooks } from '../base/extensions.js';
import { clock, formatClockTime, formatDuration } from './state/clock.js';
import * as Plan from './state/sprintPlan.js';
import { islandContent, islandShell } from './components/Island.js';
import { adjustSheet, parkedSheet, sheet } from './components/ParkedSheet.js';
import { spotlight } from './components/Spotlight.js';
import { saveGlyph } from './components/glyphs.js';
import {
  addTimeAlert,
  aheadAlert,
  mildAlert,
  parkedAlert,
  severeSheet,
  stuckAlert,
} from './components/SprintAlert.js';
import { studyChooser } from './screens/StudyChooser.js';
import { defaultDraft, examSetup, resolveChip } from './screens/ExamSetup.js';
import {
  shiftMonth,
  withDay,
  withHour,
  withMeridiem,
  withMinute,
} from './components/DateTimePicker.js';
import { planBuilding, planError, planReady } from './screens/PlanReady.js';
import { chapterDone, playReallocation } from './screens/ChapterDone.js';
import { sprintDone } from './screens/SprintDone.js';
import { debugPanel } from './debug/DebugPanel.js';
import { modeBar } from './debug/ModeBar.js';

const params = new URLSearchParams(window.location.search);

const ov = {
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
    chipKey: null,
    selected: [],
    shaky: [],
    error: null,
  },
  coachShown: false,
  spotlightDone: false,
  reviewTerm: null,
  stats: { parkedSolved: 0 },
  debugOpen: params.get('debug') === '1',
  forcedPlanError: false,
  log: [],
  phaseEnteredAt: Date.now(),
};

let root = null;
let islandNode = null;
let unsubscribeClock = null;
let celebrateTimer = null;
let suppressClickUntil = 0;

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

// Phases where the overlay draws a full screen of its own over the base.
const OVERLAY_SCREENS = new Set([
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
  return (
    ov.mode === 'sprint' &&
    !ov.spotlightDone &&
    !ov.sheet &&
    ov.phase === 'idle' &&
    window.__base.state.route === 'folder'
  );
}

function render() {
  if (!root) return;
  root.dataset.mode = ov.mode;
  window.requestAnimationFrame(measureIsland);
  window.setTimeout(measureIsland, 420);

  const screenLayer = root.querySelector('[data-layer="screen"]');
  const sheetLayer = root.querySelector('[data-layer="sheet"]');
  const debugLayer = root.querySelector('[data-layer="debug"]');
  const barLayer = root.querySelector('[data-layer="bar"]');

  let screen = '';
  if (ov.mode === 'sprint') {
    if (ov.phase === 'setup') screen = examSetup(ov.setup, clock.now());
    if (ov.phase === 'building') screen = planBuilding(course.sets.map((set) => Plan.shortTitle(set.chapter)));
    if (ov.phase === 'plan-error') screen = planError();
    if (ov.phase === 'plan') screen = planReady(ov.plan);
    if (ov.phase === 'chapter-done') screen = chapterDone(ov.plan, ov.chapterIndex);
    if (ov.phase === 'sprint-done') screen = sprintDone(ov.plan, sprintStats());
  }
  const needsShell = Boolean(screen);
  const hadChapterDone = Boolean(screenLayer.querySelector('.ov-chapter-done'));
  screenLayer.innerHTML = needsShell ? `<div class="phone-shell">${screen}</div>` : '';
  screenLayer.classList.toggle('is-visible', needsShell);
  if (ov.phase === 'chapter-done' && !hadChapterDone) {
    window.requestAnimationFrame(() => playReallocation(screenLayer));
  }

  let sheetMarkup = '';
  if (ov.mode === 'sprint' && ov.sheet === 'chooser') sheetMarkup = studyChooser();
  if (ov.mode === 'sprint' && ov.sheet === 'parked') {
    sheetMarkup = parkedSheet(ov.plan, { inReview: ov.stage === 'review' });
  }
  if (ov.mode === 'sprint' && ov.sheet === 'adjust') sheetMarkup = adjustSheet(ov.plan);
  if (ov.mode === 'sprint' && ov.sheet === 'severe' && ov.severe) sheetMarkup = severeSheet(ov.severe);
  if (ov.mode === 'sprint' && ov.sheet === 'review' && ov.reviewTerm) sheetMarkup = reviewSheet();
  const showSpotlight = !sheetMarkup && spotlightVisible();
  if (showSpotlight) sheetMarkup = spotlight();
  sheetLayer.innerHTML = sheetMarkup;
  sheetLayer.classList.toggle('is-visible', Boolean(sheetMarkup));
  document.documentElement.dataset.spotlight = showSpotlight ? 'true' : 'false';

  debugLayer.innerHTML = ov.debugOpen ? debugPanel(ov) : '';
  debugLayer.classList.toggle('is-visible', ov.debugOpen);
  barLayer.innerHTML = modeBar(ov);

  document.documentElement.dataset.sprintActive = islandVisible() ? 'true' : 'false';
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
  if (!islandVisible()) return;
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

/* -------------------------------------------------------------------- flow */

function openChooser() {
  ov.sheet = 'chooser';
  ov.spotlightDone = true;
  logEvent('chooser-open');
  render();
}

function openSetup() {
  ov.sheet = null;
  ov.spotlightDone = true;
  ov.setup = {
    examAt: null,
    draftAt: defaultDraft(clock.now()),
    monthAnchor: defaultDraft(clock.now()),
    picker: null,
    chipKey: null,
    selected: course.sets.map((_, index) => index),
    shaky: [],
    error: null,
  };
  setPhase('setup');
  render();
}

function makePlan() {
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
    });
    logEvent('plan-built', {
      chapters: ov.plan.chapters.map((chapter) => ({ title: chapter.short, allotted: chapter.allotted, shaky: chapter.shaky })),
      finalReview: ov.plan.finalReview.allotted,
      tight: ov.plan.tight,
    });
    setPhase('plan');
    render();
  }, 1200);
}

function startSprint() {
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

function onOverlayClick(event) {
  if (Date.now() < suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
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
    spotlight: () => openChooser(),
    'plan-my-time': () => {
      logEvent('plan-my-time', { from: window.__base.state.route });
      openSetup();
    },
    'study-all': () => {
      ov.sheet = null;
      logEvent('chooser-choice', { choice: 'study-all' });
      window.__base.openSet(0);
      render();
    },
    'prep-exam': () => {
      logEvent('chooser-choice', { choice: 'prep-exam' });
      openSetup();
    },
    'dismiss-sheet': () => {
      ov.sheet = null;
      render();
    },
    'cancel-setup': () => {
      setPhase('idle');
      ov.spotlightDone = true;
      window.__base.reset();
      render();
    },
    'exam-chip': () => {
      const key = target.dataset.key;
      ov.setup.chipKey = key;
      ov.setup.error = null;
      ov.setup.picker = null;
      ov.setup.examAt = resolveChip(key, clock.now());
      ov.setup.draftAt = ov.setup.examAt;
      ov.setup.monthAnchor = ov.setup.examAt;
      logEvent('exam-chip', { key });
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
    'make-plan': () => makePlan(),
    'retry-plan': () => makePlan(),
    'back-to-setup': () => {
      setPhase('setup');
      render();
    },
    'donut-slice': () => focusSlice(target.dataset.slice, 'legend'),
    'start-sprint': () => {
      logEvent('plan-accepted', { total: Plan.totalAllotted(ov.plan) });
      startSprint();
    },
    'open-adjust': () => {
      ov.sheet = 'adjust';
      logEvent('adjust-open');
      render();
    },
    adjust: () => {
      Plan.adjustChapter(ov.plan, Number(target.dataset.chapter), Number(target.dataset.delta));
      render();
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
  ov.setup.chipKey = null;
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
    chipKey: 'hour6',
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
  clock.reset();
  ov.plan = null;
  ov.sheet = null;
  ov.severe = null;
  ov.island = { state: 'compact', alert: null, message: '' };
  ov.coachShown = false;
  ov.spotlightDone = false;
  ov.stats = { parkedSolved: 0 };
  ov.log = [];
  setPhase('idle');
  window.__base.reset();
  render();
}

/* -------------------------------------------------------------------- mode */

const sprintHooks = {
  interceptClick(event) {
    if (ov.mode !== 'sprint') return false;

    const studyAll = event.target.closest('.sticky-action button');
    if (studyAll && window.__base.state.route === 'folder') {
      openChooser();
      return true;
    }

    // Closing a study screen steps out of the sprint but keeps the plan, so
    // the island can offer to resume instead of vanishing.
    if (sprintRunning() && event.target.closest('.app-header .icon-button[data-nav]')) {
      logEvent('sprint-exited', { from: ov.stage });
      setPhase('idle');
      ov.spotlightDone = true;
      render();
      return false;
    }
    return false;
  },

  afterRender() {
    if (ov.mode !== 'sprint') return;
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
    goToLearn();
    return true;
  },

  onLearnComplete() {
    if (ov.mode !== 'sprint' || !ov.plan || ov.phase !== 'study') return false;
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
  ov.sheet = null;
  ov.spotlightDone = false;
  ov.island = { state: 'compact', alert: null, message: '' };
  setPhase('idle');
  logEvent('mode', { mode });
  window.__base.reset();
  render();
}

/* -------------------------------------------------------------------- boot */

function boot() {
  injectStyles();
  buildRoot();
  document.addEventListener('click', onOverlayClick);
  root.addEventListener('pointerover', onOverlayHover);
  attachParkGestures();
  attachDebugTap();
  if (ov.mode === 'sprint') {
    setHooks(sprintHooks);
    unsubscribeClock = clock.subscribe(tick);
  }
  render();
  window.__sprint = { ov, clock, Plan, setMode, exportLog, render };
}

if (window.__base) boot();
else window.addEventListener('DOMContentLoaded', boot, { once: true });

export { formatClockTime, formatDuration };
