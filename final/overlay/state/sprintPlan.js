// Plan model and every rule that moves minutes around.
// Nothing here touches the DOM.

export const CHAPTER_TERM_COUNT = 8;
// No final review: every planned minute goes to a chapter. The model keeps
// plan.finalReview at 0 so code that reads it keeps working.
export const FINAL_REVIEW_SHARE = 0;
export const SHAKY_WEIGHT = 1.3;
// Flashcards and practice together, per card.
export const MINUTES_PER_CARD = 2.5;
export const STUDY_STEP = 15;
export const STAGE_SPLIT = { flashcards: 0.3, learn: 0.7 };
export const TIGHT_CHAPTER_MINUTES = 5;
export const MILD_OVERRUN_LIMIT = 10;
export const PACE_CHECK_FRACTION = 0.7;

export function shortTitle(chapterTitle) {
  return chapterTitle.split('·')[0].trim();
}

export function chapterWeight(isShaky) {
  return isShaky ? SHAKY_WEIGHT : 1;
}

/**
 * How long the picked sets take, and what to recommend. The study time and
 * the time until the exam are different numbers: the plan is built from the
 * first, and the second only caps it.
 */
export function recommendStudy({ sets, selected, shaky, examAt, now }) {
  const raw = selected.reduce((sum, setIndex) => {
    const cards = Math.min(CHAPTER_TERM_COUNT, sets[setIndex]?.terms.length || 0);
    return sum + cards * MINUTES_PER_CARD * chapterWeight(shaky.includes(setIndex));
  }, 0);
  const estimate = Math.max(STUDY_STEP, Math.ceil(raw / STUDY_STEP) * STUDY_STEP);
  const untilExam = Math.max(0, Math.floor((examAt - now) / 60000));
  const max = untilExam;
  const min = Math.min(STUDY_STEP, max);
  const recommended = Math.min(estimate, max);
  return { raw, estimate, untilExam, recommended, min, max };
}

export function createPlan({ examAt, startedAt, sets, selected, shaky, studyMinutes }) {
  const chapters = sets
    .map((set, setIndex) => ({ set, setIndex }))
    .filter(({ setIndex }) => selected.includes(setIndex))
    .map(({ set, setIndex }, order) => ({
      id: `chapter-${setIndex}`,
      setIndex,
      order,
      title: set.chapter,
      short: shortTitle(set.chapter),
      shaky: shaky.includes(setIndex),
      allotted: 0,
      stages: { ...STAGE_SPLIT },
      used: 0,
      answered: 0,
      total: Math.min(CHAPTER_TERM_COUNT, set.terms.length),
      status: order === 0 ? 'upcoming' : 'upcoming',
      parked: [],
      missed: {},
      stuckShown: [],
      alerted: false,
      result: null,
    }));

  const advice = recommendStudy({ sets, selected, shaky, examAt, now: startedAt });
  const plan = {
    examAt,
    startedAt,
    untilExam: advice.untilExam,
    // Debug paths build a plan without a study step; they get the recommendation.
    studyMinutes: Math.round(studyMinutes ?? advice.recommended),
    chapters,
    finalReview: { allotted: 0, used: 0 },
    log: [],
    tight: false,
    severeShown: false,
  };

  allocate(plan);
  return plan;
}

export function termScope(set) {
  return set.terms.slice(0, CHAPTER_TERM_COUNT).map((_, index) => index);
}

function allocate(plan) {
  // Built from the study time the user chose, not from the time until the exam.
  const available = Math.max(0, plan.studyMinutes);
  const reserved = Math.round(available * FINAL_REVIEW_SHARE);
  const pool = Math.max(0, available - reserved);

  const weights = plan.chapters.map((chapter) => chapterWeight(chapter.shaky));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  // Whole minutes by largest remainder, so the chapters add up to the study
  // time exactly. The leftover used to go to final review.
  const exact = plan.chapters.map((_, index) => (pool * weights[index]) / totalWeight);
  const minutes = exact.map((value) => Math.max(1, Math.floor(value)));
  let left = pool - minutes.reduce((sum, value) => sum + value, 0);
  exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest)
    .forEach(({ index }) => {
      if (left > 0) { minutes[index] += 1; left -= 1; }
    });
  plan.chapters.forEach((chapter, index) => { chapter.allotted = minutes[index]; });

  plan.finalReview.allotted = Math.max(0, reserved);
  plan.tight = plan.chapters.some((chapter) => chapter.allotted < TIGHT_CHAPTER_MINUTES);
  if (plan.tight) {
    plan.chapters.forEach((chapter) => {
      chapter.stages = { flashcards: 0, learn: 1 };
    });
  }
  log(plan, 'allocate', { available, reserved, chapters: plan.chapters.map((c) => c.allotted) });
}

export function log(plan, type, detail) {
  plan.log.push({ at: Date.now(), type, detail });
}

export function stageMinutes(chapter, stage) {
  return chapter.allotted * chapter.stages[stage];
}

export function remainingMs(chapter) {
  return (chapter.allotted - chapter.used) * 60000;
}

export function totalAllotted(plan) {
  return plan.chapters.reduce((sum, chapter) => sum + chapter.allotted, 0) + plan.finalReview.allotted;
}

export function nextUpcoming(plan, fromIndex) {
  return plan.chapters.find((chapter, index) => index > fromIndex && chapter.status === 'upcoming') || null;
}

/** Settle a chapter: move the difference between budget and spend. */
export function finishChapter(plan, index) {
  const chapter = plan.chapters[index];
  chapter.status = 'done';
  const difference = chapter.allotted - chapter.used;
  const amount = Math.round(Math.abs(difference));
  const target = nextUpcoming(plan, index);

  if (difference >= 1) {
    if (target) target.allotted += amount;
    else plan.finalReview.allotted += amount;
    chapter.result = { kind: 'saved', amount, target: target ? target.short : 'Final review' };
  } else if (difference <= -1) {
    const fromFinal = Math.min(amount, plan.finalReview.allotted);
    plan.finalReview.allotted -= fromFinal;
    let rest = amount - fromFinal;
    if (rest > 0 && target) {
      const fromNext = Math.min(rest, Math.max(0, target.allotted - TIGHT_CHAPTER_MINUTES));
      target.allotted -= fromNext;
      rest -= fromNext;
    }
    chapter.result = { kind: 'over', amount, target: 'Final review' };
  } else {
    chapter.result = { kind: 'even', amount: 0, target: null };
  }

  log(plan, 'chapter-settled', { chapter: chapter.short, ...chapter.result });
  return chapter.result;
}

/** Add minutes to the active chapter, always taken from somewhere named. */
export function addTime(plan, index, minutes, source) {
  const chapter = plan.chapters[index];
  if (source === 'final') {
    const taken = Math.min(minutes, plan.finalReview.allotted);
    plan.finalReview.allotted -= taken;
    chapter.allotted += taken;
    log(plan, 'add-time', { chapter: chapter.short, minutes: taken, source: 'Final review' });
    return { minutes: taken, source: 'Final review' };
  }
  const donor = plan.chapters.find((entry) => entry.id === source);
  if (!donor) return { minutes: 0, source: null };
  const taken = Math.min(minutes, Math.max(0, donor.allotted - TIGHT_CHAPTER_MINUTES));
  donor.allotted -= taken;
  chapter.allotted += taken;
  log(plan, 'add-time', { chapter: chapter.short, minutes: taken, source: donor.short });
  return { minutes: taken, source: donor.short };
}

export function adjustChapter(plan, index, delta) {
  // With no final review to borrow from, changing a chapter changes the total
  // study time. It can grow up to the time until the exam, never past it.
  const chapter = plan.chapters[index];
  const others = plan.chapters.reduce((sum, entry, i) => (i === index ? sum : sum + entry.allotted), 0);
  const ceiling = Math.max(1, (plan.untilExam ?? Infinity) - others);
  chapter.allotted = Math.max(1, Math.min(ceiling, chapter.allotted + delta));
  plan.studyMinutes = others + chapter.allotted;
  log(plan, 'adjust', { chapter: chapter.short, delta, allotted: chapter.allotted, studyMinutes: plan.studyMinutes });
}

/** projected = used / progressFraction */
export function projectChapter(chapter) {
  if (!chapter.total || !chapter.answered) return null;
  const fraction = Math.min(1, chapter.answered / chapter.total);
  if (fraction <= 0) return null;
  return chapter.used / fraction;
}

export function paceCheck(plan, index) {
  const chapter = plan.chapters[index];
  if (chapter.alerted) return null;
  if (chapter.used < chapter.allotted * PACE_CHECK_FRACTION) return null;
  const projected = projectChapter(chapter);
  if (projected === null) return null;
  const overrun = Math.round(projected - chapter.allotted);
  if (overrun <= 0) return null;

  const upcoming = plan.chapters.filter((entry, position) => position > index && entry.status === 'upcoming');
  const lastChapter = upcoming[upcoming.length - 1];
  const spare = plan.finalReview.allotted;

  if (lastChapter && overrun > spare + MILD_OVERRUN_LIMIT && !plan.severeShown) {
    return { level: 'severe', overrun, chapter, victim: lastChapter, receivers: upcoming.slice(0, -1) };
  }
  if (overrun <= MILD_OVERRUN_LIMIT) {
    return { level: 'mild', overrun, chapter, donors: upcoming };
  }
  return null;
}

export function applySevere(plan, suggestion) {
  const victim = suggestion.victim;
  victim.status = 'skipped';
  const freed = victim.allotted;
  victim.allotted = 0;
  const receivers = suggestion.receivers.length ? suggestion.receivers : [suggestion.chapter];
  const share = Math.floor(freed / receivers.length);
  receivers.forEach((chapter, index) => {
    chapter.allotted += index === receivers.length - 1 ? freed - share * (receivers.length - 1) : share;
  });
  plan.severeShown = true;
  log(plan, 'severe-applied', { skipped: victim.short, freed, receivers: receivers.map((c) => c.short) });
}

export function missedAndParked(plan) {
  return plan.chapters
    .filter((chapter) => chapter.status !== 'skipped')
    .map((chapter) => ({
      chapter,
      termIndices: [
        ...new Set([...Object.keys(chapter.missed).map(Number), ...chapter.parked]),
      ].sort((a, b) => a - b),
    }))
    .filter((entry) => entry.termIndices.length);
}

export function parkedCount(plan) {
  return plan.chapters.reduce((sum, chapter) => sum + chapter.parked.length, 0);
}
