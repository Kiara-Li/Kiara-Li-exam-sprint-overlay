// Question generation for Learn and Test.
// Deterministic: the same set and term indices always produce the same
// questions, so re-rendering never reshuffles what the user is looking at.

function seeded(value) {
  let x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pickDistractors(pool, count, seed) {
  const available = [...pool];
  const picked = [];
  let step = 0;
  while (picked.length < count && available.length) {
    const index = Math.floor(seeded(seed + step) * available.length);
    picked.push(available.splice(index, 1)[0]);
    step += 1;
  }
  return picked;
}

function order(items, seed) {
  return items
    .map((item, index) => ({ item, key: seeded(seed + index * 7) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

export function buildQuestions(set, termIndices = null) {
  const scope = termIndices && termIndices.length ? termIndices : set.terms.map((_, index) => index);
  return scope.map((termIndex, position) => {
    const [term, definition] = set.terms[termIndex];
    // One term per set carries hand-picked, near-identical distractors so that
    // every participant meets a genuinely hard question early in the round.
    const isHard = Boolean(set.hard) && set.hard.term === termIndex;
    const distractors = isHard
      ? set.hard.distractors.filter((index) => index !== termIndex).slice(0, 3)
      : pickDistractors(
          set.terms
            .map((_, index) => index)
            .filter((index) => index !== termIndex && set.terms[index][0] !== term),
          3,
          termIndex + position * 3 + 1,
        );
    const options = order([termIndex, ...distractors], termIndex + position * 5 + 2);
    return {
      termIndex,
      term,
      definition,
      prompt: definition,
      hard: isHard,
      answers: options.map((index) => set.terms[index][0]),
      correct: options.indexOf(termIndex),
    };
  });
}
