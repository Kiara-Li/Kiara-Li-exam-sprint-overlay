const rasterIcons = new Set([
  'avatar',
  'back',
  'cards',
  'check',
  'chevron',
  'close',
  'expand',
  'folder',
  'gear',
  'guide-magenta',
  'learn',
  'match',
  'more',
  'play',
  'plus',
  'search',
  'set-cyan',
  'star',
  'test',
  'test-large',
  'trophy',
  'undo',
  'volume',
  'wrong',
]);

export function icon(name, label = '') {
  const resolved = rasterIcons.has(name) ? name : 'cards';
  const alt = label ? ` alt="${label}"` : ' alt="" aria-hidden="true"';
  return `<img class="icon icon-${resolved}" src="./base/assets/icons/${resolved}.png"${alt}>`;
}
