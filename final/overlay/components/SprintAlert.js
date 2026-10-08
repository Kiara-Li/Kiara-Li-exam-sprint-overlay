import { sheet } from './ParkedSheet.js';

/** Ahead: no decision to make, so it collapses on its own. */
export function aheadAlert(result) {
  return {
    level: 'ahead',
    message: `+${result.amount} min saved. Added to ${result.target}.`,
    actions: [],
    autoCollapse: true,
  };
}

/** Mild: state the cost, then offer where the time comes from. */
export function mildAlert(suggestion) {
  const donors = suggestion.donors.slice(-1);
  const actions = [
    ...donors.map((chapter) => ({ label: chapter.short, kind: 'take', source: chapter.id })),
    { label: 'Final review', kind: 'take', source: 'final' },
    { label: 'Keep going', kind: 'dismiss' },
  ];
  return {
    level: 'mild',
    message: `${suggestion.chapter.short} is running about ${suggestion.overrun} min over.`,
    detail: 'Take the time from:',
    actions,
    autoCollapse: false,
  };
}

/** The "+5 min" case: mild in tone, same shape, always names a donor. */
export function addTimeAlert(plan, chapterIndex) {
  const donors = plan.chapters.filter(
    (chapter, index) => index > chapterIndex && chapter.status === 'upcoming',
  );
  const last = donors[donors.length - 1];
  const actions = [
    ...(last ? [{ label: last.short, kind: 'take', source: last.id }] : []),
    { label: 'Final review', kind: 'take', source: 'final' },
    { label: 'Never mind', kind: 'dismiss' },
  ];
  return {
    level: 'mild',
    message: '+5 min for this chapter.',
    detail: 'Take the time from:',
    actions,
    autoCollapse: false,
  };
}

/**
 * Missed the same term twice. The cost is time, so the island says so and
 * offers the way out rather than just sympathising.
 */
export function stuckAlert(term) {
  return {
    level: 'stuck',
    message: `“${term}” is costing you time.`,
    detail: 'Save it for the final review and keep moving?',
    actions: [
      { label: 'Save it for later', kind: 'park-current' },
      { label: 'Keep trying', kind: 'dismiss' },
    ],
    primaryFirst: true,
    autoCollapse: false,
  };
}

/** Parked questions left at the end of a chapter. */
export function parkedAlert(count) {
  return {
    level: 'mild',
    message: `${count} saved for later. Tackle them now?`,
    actions: [
      { label: 'Yes · 5 min', kind: 'work-parked' },
      { label: 'Move to Final review', kind: 'defer-parked' },
    ],
    primaryFirst: true,
    autoCollapse: false,
  };
}

/** Severe escalates out of the island and into a sheet. */
export function severeSheet(suggestion) {
  const receivers = suggestion.receivers.map((chapter) => chapter.short);
  const receiverCopy = receivers.length
    ? receivers.join(' and ')
    : suggestion.chapter.short;
  return sheet({
    name: 'severe',
    title: `${suggestion.victim.short} won’t fit at this pace.`,
    body: `
      <p class="ov-sheet-body">Suggested: skip ${suggestion.victim.short} and give its ${suggestion.victim.allotted} min to ${receiverCopy}.</p>`,
    footer: `
      <button class="primary-button ov-full" data-ov="severe-accept">Use suggestion</button>
      <button class="ov-text-button" data-ov="severe-decide">I’ll decide</button>`,
  });
}
