import {
  flashCompleteScreen,
  flashcardScreen,
  folderScreen,
  learnCompleteScreen,
  overviewScreen,
  quizScreen,
  testScreen,
  testSetupScreen,
} from './screens/screens.js';
import { course } from './data.js';
import { buildQuestions } from './quiz.js';
import { callHook } from './extensions.js';
import './overlay-loader.js';

const app = document.querySelector('#app');

const state = {
  route: 'folder',
  setIndex: 0,
  cardIndex: 0,
  flipped: false,
  studyQueue: [],
  queuePosition: 0,
  ratings: {},
  termScope: null,
  learn: { questions: [], pos: 0, answer: null, missed: {}, retried: {} },
  test: { questions: [], pos: 0, answer: null, correct: 0 },
};

let swipeStartX = null;
let swipeStage = null;
let suppressFlip = false;

const swipeThreshold = 56;
const strongSwipeThreshold = 140;

function render() {
  let screen = folderScreen();
  if (state.route === 'overview') screen = overviewScreen(state.setIndex);
  if (state.route === 'flashcards') screen = flashcardScreen(state.setIndex, state.cardIndex, state.flipped, state.ratings, state.termScope);
  if (state.route === 'flash-complete') screen = flashCompleteScreen(state.setIndex, state.termScope);
  if (state.route === 'quiz') screen = quizScreen(state.setIndex, state.learn);
  if (state.route === 'learn-complete') screen = learnCompleteScreen();
  if (state.route === 'test-setup') screen = testSetupScreen(state.setIndex);
  if (state.route === 'test') screen = testScreen(state.setIndex, state.test);
  app.innerHTML = `<div class="phone-shell">${screen}</div>`;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  callHook('afterRender', state);
}

app.addEventListener('click', (event) => {
  if (callHook('interceptClick', event) === true) return;

  const nav = event.target.closest('[data-nav]');
  if (nav) {
    const route = nav.dataset.nav;
    if (route === 'flashcards') resetFlashcards();
    if (route === 'quiz') resetLearn();
    if (route === 'test') resetTest();
    state.route = route;
    state.flipped = false;
    render();
    return;
  }

  const openSet = event.target.closest('[data-open-set]');
  if (openSet) {
    state.setIndex = Number(openSet.dataset.openSet);
    state.cardIndex = 0;
    state.termScope = null;
    state.route = 'overview';
    resetFlashcards();
    render();
    return;
  }

  const rating = event.target.closest('[data-rate]');
  if (rating) {
    rateCurrentCard(rating.dataset.rate);
    render();
    return;
  }

  if (event.target.closest('[data-flip-card]')) {
    if (suppressFlip) return;
    state.flipped = !state.flipped;
    render();
    return;
  }

  const testSwitch = event.target.closest('.switch');
  if (testSwitch) {
    testSwitch.classList.toggle('is-on');
    return;
  }

  if (event.target.closest('[data-learn-continue]')) {
    advanceLearn();
    return;
  }

  const answer = event.target.closest('[data-answer]');
  if (answer && state.route === 'quiz') {
    answerLearn(Number(answer.dataset.answer));
    return;
  }

  if (answer && state.route === 'test') {
    answerTest(Number(answer.dataset.answer));
  }
});

app.addEventListener('pointerdown', (event) => {
  if (callHook('interceptSwipe', event) === true) return;
  const card = event.target.closest('[data-flip-card]');
  if (!card) return;
  swipeStartX = event.clientX;
  swipeStage = card.closest('[data-swipe-stage]');
  swipeStage?.classList.add('is-dragging');
});

app.addEventListener('pointermove', (event) => {
  if (swipeStartX === null || !swipeStage) return;
  const distance = event.clientX - swipeStartX;
  swipeStage.style.setProperty('--drag-x', `${distance}px`);
  swipeStage.style.setProperty('--drag-rotate', `${distance / 30}deg`);
});

app.addEventListener('pointerup', finishSwipe);
app.addEventListener('pointercancel', cancelSwipe);

function finishSwipe(event) {
  if (swipeStartX === null) return;
  const distance = event.clientX - swipeStartX;
  let rating = '';
  if (distance <= -strongSwipeThreshold) rating = 'repeat';
  else if (distance <= -swipeThreshold) rating = 'hard';
  else if (distance >= strongSwipeThreshold) rating = 'easy';
  else if (distance >= swipeThreshold) rating = 'okay';

  if (rating) {
    suppressFlip = true;
    rateCurrentCard(rating);
    render();
    window.setTimeout(() => {
      suppressFlip = false;
    }, 0);
  } else {
    cancelSwipe();
  }

  swipeStartX = null;
  swipeStage = null;
}

function cancelSwipe() {
  swipeStage?.classList.remove('is-dragging');
  swipeStage?.style.removeProperty('--drag-x');
  swipeStage?.style.removeProperty('--drag-rotate');
  swipeStartX = null;
  swipeStage = null;
}

function currentScope() {
  if (state.termScope && state.termScope.length) return state.termScope;
  return course.sets[state.setIndex].terms.map((_, index) => index);
}

function resetFlashcards() {
  state.studyQueue = [...currentScope()];
  state.queuePosition = 0;
  state.cardIndex = state.studyQueue[0];
  state.ratings = {};
  state.flipped = false;
}

function rateCurrentCard(rating) {
  const currentCard = state.cardIndex;
  state.ratings[currentCard] = rating;

  const completed = state.studyQueue.slice(0, state.queuePosition + 1);
  const pending = state.studyQueue
    .slice(state.queuePosition + 1)
    .filter((cardIndex) => cardIndex !== currentCard);

  if (rating === 'repeat') pending.splice(Math.min(1, pending.length), 0, currentCard);
  if (rating === 'hard') pending.push(currentCard);

  state.studyQueue = [...completed, ...pending];
  state.queuePosition += 1;
  state.flipped = false;

  if (state.queuePosition >= state.studyQueue.length) {
    if (callHook('onFlashComplete') === true) return;
    state.route = 'flash-complete';
    return;
  }

  state.cardIndex = state.studyQueue[state.queuePosition];
  callHook('onFlashAdvance', state);
}

// Sprint-only queue operation. Each term keeps one slot; deferred terms move
// within the pending part of the queue instead of adding another attempt.
// The existing four-rating path above is unchanged in original mode.
function sortFlashcard(level) {
  const position = state.queuePosition;
  const current = state.studyQueue[position];
  if (current === undefined) return null;
  let insertAt = null;
  if (level === 'done') {
    state.queuePosition += 1;
  } else {
    state.studyQueue.splice(position, 1);
    insertAt = level === 'again'
      ? Math.min(position + 2, state.studyQueue.length)
      : state.studyQueue.length;
    state.studyQueue.splice(insertAt, 0, current);
  }
  state.flipped = false;
  if (state.queuePosition >= state.studyQueue.length) {
    state.route = 'flash-complete';
    callHook('onFlashComplete');
  } else {
    state.cardIndex = state.studyQueue[state.queuePosition];
    callHook('onFlashAdvance', state);
  }
  render();
  return { insertAt };
}

function resetLearn() {
  state.learn = {
    questions: buildQuestions(course.sets[state.setIndex], state.termScope),
    pos: 0,
    answer: null,
    missed: {},
    retried: {},
  };
}

function answerLearn(index) {
  const question = state.learn.questions[state.learn.pos];
  if (!question || state.learn.answer !== null) return;
  state.learn.answer = index;
  const correct = index === question.correct;
  if (!correct) {
    state.learn.missed[question.termIndex] = (state.learn.missed[question.termIndex] || 0) + 1;
  }
  callHook('onLearnAnswer', { question, correct, learn: state.learn });
  render();
}

function advanceLearn() {
  const question = state.learn.questions[state.learn.pos];
  if (!question) return;
  const wasWrong = state.learn.answer !== null && state.learn.answer !== question.correct;
  if (wasWrong && !state.learn.retried[question.termIndex]) {
    state.learn.retried[question.termIndex] = true;
    state.learn.questions.push(question);
  }
  state.learn.answer = null;
  state.learn.pos += 1;
  if (state.learn.pos >= state.learn.questions.length) {
    if (callHook('onLearnComplete', state.learn) === true) return;
    state.route = 'learn-complete';
    render();
    return;
  }
  callHook('onLearnAdvance', state.learn);
  render();
}

// Sprint-only Learn queue operation. It bypasses the base's one-time retry and
// keeps the number of term slots fixed while deferred questions move forward.
function sortLearnQuestion(level) {
  const learn = state.learn;
  const question = learn.questions[learn.pos];
  if (!question) return null;
  let insertAt = null;
  if (level === 'done') {
    learn.pos += 1;
  } else {
    learn.questions.splice(learn.pos, 1);
    insertAt = level === 'again'
      ? Math.min(learn.pos + 2, learn.questions.length)
      : learn.questions.length;
    learn.questions.splice(insertAt, 0, question);
  }
  learn.answer = null;
  if (learn.pos >= learn.questions.length) {
    if (callHook('onLearnComplete', learn) === true) return { insertAt };
    state.route = 'learn-complete';
  } else {
    callHook('onLearnAdvance', learn);
  }
  render();
  return { insertAt };
}

function resetTest() {
  state.test = {
    questions: buildQuestions(course.sets[state.setIndex], state.termScope),
    pos: 0,
    answer: null,
    correct: 0,
  };
}

function answerTest(index) {
  const question = state.test.questions[state.test.pos];
  if (!question || state.test.answer !== null) return;
  state.test.answer = index;
  const correct = index === question.correct;
  if (correct) state.test.correct += 1;
  callHook('onTestAnswer', { question, correct, test: state.test });
  render();
  window.setTimeout(() => {
    state.test.answer = null;
    state.test.pos += 1;
    if (state.test.pos >= state.test.questions.length) {
      if (callHook('onTestComplete', state.test) === true) return;
      state.route = 'learn-complete';
    }
    render();
  }, 420);
}

export const base = {
  state,
  render,
  go(route) {
    state.route = route;
    render();
  },
  openSet(setIndex) {
    state.setIndex = setIndex;
    state.route = 'overview';
    render();
  },
  startFlashcards(setIndex, termScope = null) {
    state.setIndex = setIndex;
    state.termScope = termScope;
    resetFlashcards();
    state.route = 'flashcards';
    render();
  },
  startLearn(setIndex, termScope = null) {
    state.setIndex = setIndex;
    state.termScope = termScope;
    resetLearn();
    state.route = 'quiz';
    render();
  },
  startTest(setIndex, termScope = null, questions = null) {
    state.setIndex = setIndex;
    state.termScope = termScope;
    resetTest();
    if (questions) state.test.questions = questions;
    state.route = 'test';
    render();
  },
  removeFlashcard(termIndex) {
    const completed = state.studyQueue.slice(0, state.queuePosition);
    const pending = state.studyQueue.slice(state.queuePosition).filter((index) => index !== termIndex);
    state.studyQueue = [...completed, ...pending];
    if (state.termScope) state.termScope = state.termScope.filter((index) => index !== termIndex);
    state.flipped = false;
    if (state.queuePosition >= state.studyQueue.length) {
      if (callHook('onFlashComplete') === true) return;
      state.route = 'flash-complete';
      render();
      return;
    }
    state.cardIndex = state.studyQueue[state.queuePosition];
    render();
  },
  sortFlashcard,
  sortLearnQuestion,
  removeLearnQuestion(termIndex) {
    const upcoming = state.learn.questions.slice(state.learn.pos);
    const kept = upcoming.filter((question) => question.termIndex !== termIndex);
    state.learn.questions = [...state.learn.questions.slice(0, state.learn.pos), ...kept];
    state.learn.answer = null;
    if (state.learn.pos >= state.learn.questions.length) {
      if (callHook('onLearnComplete', state.learn) === true) return;
      state.route = 'learn-complete';
    }
    render();
  },
  /**
   * Put questions back into the round. `next: true` places them at the front
   * of what is left, so "do this one now" really does come up now.
   */
  appendLearnQuestions(questions, { next = false } = {}) {
    if (!questions.length) return;
    if (next) {
      // Mid-question, slot them in behind the one on screen rather than
      // swapping it out from under the user.
      const at = state.learn.answer === null ? state.learn.pos : state.learn.pos + 1;
      const head = state.learn.questions.slice(0, at);
      const tail = state.learn.questions.slice(at);
      state.learn.questions = [...head, ...questions, ...tail];
    } else {
      state.learn.questions = [...state.learn.questions, ...questions];
    }
    if (state.route !== 'quiz') state.route = 'quiz';
    render();
  },
  buildQuestions,
  reset() {
    state.route = 'folder';
    state.setIndex = 0;
    state.termScope = null;
    resetFlashcards();
    render();
  },
};

window.__base = base;

render();
