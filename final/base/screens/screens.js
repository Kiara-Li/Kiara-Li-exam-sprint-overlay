import { course } from '../data.js';
import { icon } from '../components/icons.js';
import { callHook } from '../extensions.js';
import {
  answerButton,
  appHeader,
  modeRow,
  progressBar,
  setListItem,
} from '../components/components.js';

export function folderScreen() {
  return `
    <main class="screen folder-screen">
      ${appHeader({
        back: 'folder',
        trailing: `<span class="header-actions" aria-hidden="true"><span class="icon-button decorative-icon">${icon('more')}</span><span class="icon-button decorative-icon">${icon('plus')}</span><span class="icon-button decorative-icon">${icon('search')}</span></span>`,
      })}
      <section class="folder-heading">
        <div class="folder-mark">${icon('folder')}</div>
        <h1>${course.folder}</h1>
        <p>Survey Course: 1848–1968</p>
      </section>
      <div class="folder-tabs"><span class="is-active">All</span><span>Semester</span><span>+ New tag</span></div>
      <section class="set-list" aria-label="Study sets">
        <h2>Recent⌃</h2>
        ${course.sets.map(setListItem).join('')}
      </section>
      <div class="sticky-action"><button class="soft-button" data-open-set="0">Study all</button></div>
    </main>`;
}

export function overviewScreen(setIndex) {
  const set = course.sets[setIndex];
  const preview = set.terms[0];
  return `
    <main class="screen overview-screen">
      ${appHeader({
        back: 'folder',
        trailing: `<span class="header-actions" aria-hidden="true"><span class="loading-mark"></span><span class="icon-button decorative-icon">${icon('more')}</span></span>`,
      })}
      <section class="overview-content">
        <button class="preview-card" data-nav="flashcards" aria-label="Open flashcards">
          <span>${preview[0]}</span>
          <span class="expand-mark">${icon('expand')}</span>
        </button>
        <div class="carousel-dots" aria-hidden="true"><i class="is-active"></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <h1>${set.chapter}</h1>
        <p class="overview-subtitle">${set.subtitle}</p>
        <p class="byline">${icon('avatar')}<strong>kiara201808</strong><span>${set.terms.length} terms</span></p>
        <div class="mode-list">
          ${modeRow({ iconName: 'cards', label: 'Flashcards', route: 'flashcards', badge: 'New' })}
          ${modeRow({ iconName: 'learn', label: 'Learn', route: 'quiz' })}
          ${modeRow({ iconName: 'test', label: 'Test', route: 'test-setup' })}
        </div>
      </section>
    </main>`;
}

export function flashcardScreen(setIndex, cardIndex, flipped, ratings = {}, scope = null) {
  const set = course.sets[setIndex];
  const total = scope && scope.length ? scope.length : set.terms.length;
  const card = set.terms[cardIndex];
  const ratingValues = Object.values(ratings);
  const reviewed = Object.keys(ratings).length;
  const learning = ratingValues.filter((rating) => rating === 'repeat' || rating === 'hard').length;
  const known = ratingValues.filter((rating) => rating === 'okay' || rating === 'easy').length;
  const position = Math.min(reviewed + 1, total);
  const progress = Math.round((reviewed / total) * 100);
  return `
    <main class="screen flashcard-screen">
      ${appHeader({
        close: 'overview',
        title: `${position} / ${total}`,
        trailing: `<span class="icon-button decorative-icon" aria-hidden="true">${icon('gear')}</span>`,
      })}
      <div class="progress-line flash-line" aria-label="${reviewed} of ${total} reviewed"><span style="--progress-value:${progress}%"></span></div>
      <div class="mastery-counts" aria-label="${learning} learning and ${known} known">
        <span class="is-learning">${learning}</span>
        <span class="is-known">${known}</span>
      </div>
      <section class="flashcard-stage" data-swipe-stage>
        <button class="flashcard ${flipped ? 'is-flipped' : ''}" data-flip-card aria-label="Flip card">
          <span class="flashcard-face flashcard-front">
            <span class="audio-icon">${icon('volume')}</span>
            <span class="star-icon">${icon('star')}</span>
            <strong>${card[0]}</strong>
          </span>
          <span class="flashcard-face flashcard-back">
            <span class="audio-icon">${icon('volume')}</span>
            <span class="star-icon">${icon('star')}</span>
            <strong>${card[1]}</strong>
          </span>
        </button>
      </section>
      <section class="rating-area" aria-label="How well did you know this card?">
        <div class="rating-strip">
          <button data-rate="repeat"><strong>Repeat</strong></button>
          <button data-rate="hard"><strong>Hard</strong></button>
          <button data-rate="okay"><strong>Okay</strong></button>
          <button data-rate="easy"><strong>Easy</strong></button>
        </div>
        <div class="rating-times" aria-hidden="true"><span>≤1 min</span><span>≤5 min</span><span>≤10 min</span><span>4 days</span></div>
        <p>Swipe left to review again · Swipe right when you know it</p>
      </section>
    </main>`;
}

export function flashCompleteScreen(setIndex, scope = null) {
  const set = course.sets[setIndex];
  const total = scope && scope.length ? scope.length : set.terms.length;
  const nextSet = course.sets[(setIndex + 1) % course.sets.length];
  return `
    <main class="screen flash-complete-screen">
      ${appHeader({ close: 'overview', title: `${total} / ${total}`, trailing: `<span class="icon-button decorative-icon" aria-hidden="true">${icon('gear')}</span>` })}
      <section class="flash-complete-content">
        <h1>Done! You’ve finished today’s cards for ${set.chapter}</h1>
        <p>Go to Options to set your daily flashcard limit</p>
        <div class="completion-stats"><div><strong>Terms left</strong><b>0</b></div><div><strong>Completed</strong><b>${total}</b></div></div>
        <button class="up-next" data-nav="overview"><span>${icon('cards')}</span><span><small>Up next</small><strong>${nextSet.chapter}</strong><small>${nextSet.terms.length} new</small></span><span class="up-next-arrow">›</span></button>
      </section>
    </main>`;
}

export function quizScreen(setIndex, learn) {
  const quizQuestion = learn.questions[learn.pos];
  const answeredIndex = learn.answer;
  const answered = answeredIndex !== null;
  const wrong = answered && answeredIndex !== quizQuestion.correct;
  const distractors = quizQuestion.answers
    .map((_, index) => index)
    .filter((index) => index !== quizQuestion.correct && index !== answeredIndex);
  const order = wrong
    ? [quizQuestion.correct, distractors[0], answeredIndex]
    : quizQuestion.answers.map((_, index) => index);
  const extras = callHook('learnExtras', { learn, question: quizQuestion, answered }) || '';
  return `
    <main class="screen quiz-screen ${wrong ? 'quiz-wrong' : ''}">
      ${appHeader({
        close: 'overview',
        title: `<span class="learn-title">${icon('learn')} Learn</span>`,
        trailing: `<span class="icon-button decorative-icon" aria-hidden="true">${icon('gear')}</span>`,
      })}
      ${progressBar(learn.pos + 1, learn.questions.length)}
      <section class="question-content ${answered ? 'has-feedback' : ''}" data-question-card>
        <h1>${quizQuestion.prompt}</h1>
        ${wrong ? '<h2 class="wrong-title">Not quite, you\u2019re still learning!</h2>' : '<h2>Choose the answer</h2>'}
        <div class="answer-list">
          ${order.map((index) => {
            const klass = answered && index === quizQuestion.correct ? 'is-correct' : wrong && index === answeredIndex ? 'is-wrong' : '';
            const prefix = klass === 'is-correct' ? `<span class="answer-symbol">${icon('check')}</span>` : klass === 'is-wrong' ? `<span class="answer-symbol">${icon('wrong')}</span>` : '';
            return answerButton(prefix + `<span>${quizQuestion.answers[index]}</span>`, index, klass);
          }).join('')}
        </div>
        ${extras}
      </section>
      ${answered ? '<div class="feedback-action"><button class="primary-button" data-learn-continue>Continue</button></div>' : ''}
    </main>`;
}

export function learnCompleteScreen() {
  return `
    <main class="screen learn-complete-screen">
      <button class="completion-close icon-button" data-nav="overview" aria-label="Close">${icon('close')}</button>
      <section class="learn-complete-content">
        <div class="trophy">${icon('trophy')}</div>
        <h1>Way to go! You’ve studied all the terms.</h1>
        <p>Try another round so you can get more practice with the tough ones.</p>
      </section>
      <div class="completion-actions">
        <button class="feedback-link">Share your feedback</button>
        <button class="primary-button" data-nav="quiz">Practice more</button>
        <button class="soft-button" data-nav="test-setup">Take a test</button>
      </div>
    </main>`;
}

export function testSetupScreen(setIndex) {
  const set = course.sets[setIndex];
  return `
    <main class="screen test-setup-screen">
      <button class="setup-close icon-button" data-nav="overview" aria-label="Close">${icon('close')}</button>
      <section class="test-setup-content">
        <div class="setup-intro"><p>${set.chapter}</p>${icon('test-large')}</div>
        <h1>Set up your test</h1>
        <div class="setup-options">
          <div><strong>Question count</strong><span class="select-button">15 ${icon('chevron')}</span></div>
          <div><strong>Instant feedback</strong><button class="switch" aria-label="Instant feedback"><span></span></button></div>
          <div class="answer-with"><strong>Answer with</strong><span class="select-button">Term, Definition ${icon('chevron')}</span></div>
          <hr>
          <div><strong>True/false</strong><button class="switch" aria-label="True or false"><span></span></button></div>
          <div><strong>Multiple choice</strong><button class="switch is-on" aria-label="Multiple choice"><span></span></button></div>
          <div><strong>Written</strong><button class="switch" aria-label="Written"><span></span></button></div>
        </div>
      </section>
      <div class="test-start"><button class="primary-button" data-nav="test">Start Test</button></div>
    </main>`;
}

export function testScreen(setIndex, test) {
  const testQuestion = test.questions[test.pos];
  const total = test.questions.length;
  const position = test.pos + 1;
  return `
    <main class="screen test-screen">
      ${appHeader({ close: 'test-setup', title: `${position} / ${total}`, trailing: `<span class="icon-button decorative-icon" aria-hidden="true">${icon('gear')}</span>` })}
      ${progressBar(position, total, 'line')}
      <section class="test-question">
        <h1>${testQuestion.prompt}</h1>
        <h2>Choose the answer</h2>
        <div class="answer-list">
          ${testQuestion.answers.map((answer, index) => answerButton(answer, index, test.answer === index ? 'is-selected' : '')).join('')}
        </div>
      </section>
    </main>`;
}
