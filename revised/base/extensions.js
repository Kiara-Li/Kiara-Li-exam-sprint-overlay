// Extension points for layers built on top of the base reproduction.
// Every hook defaults to undefined, so with nothing registered the base
// behaves exactly as it did before this file existed.

export const hooks = {
  interceptClick: null,
  afterRender: null,
  stableLearnLayout: null,
  learnExtras: null,
  onLearnAnswer: null,
  onLearnAdvance: null,
  onLearnComplete: null,
  onFlashAdvance: null,
  onFlashComplete: null,
  interceptSwipe: null,
  onTestAnswer: null,
  onTestComplete: null,
};

export function setHooks(next) {
  Object.assign(hooks, next);
}

export function clearHooks() {
  Object.keys(hooks).forEach((key) => {
    hooks[key] = null;
  });
}

export function callHook(name, ...args) {
  const fn = hooks[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
}
