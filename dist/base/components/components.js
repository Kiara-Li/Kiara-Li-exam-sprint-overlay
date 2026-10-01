import { icon } from './icons.js';

export function appHeader({ title = '', back = '', close = '', trailing = '' }) {
  const leading = back
    ? `<button class="icon-button" data-nav="${back}" aria-label="Back">${icon('back')}</button>`
    : close
      ? `<button class="icon-button" data-nav="${close}" aria-label="Close">${icon('close')}</button>`
      : '<span class="header-spacer"></span>';
  return `
    <header class="app-header">
      ${leading}
      <div class="app-header-title">${title}</div>
      ${trailing || '<span class="header-spacer"></span>'}
    </header>`;
}

export function progressBar(current, total, type = 'segmented') {
  if (type === 'line') {
    const width = Math.round((current / total) * 100);
    return `<div class="progress-line" aria-label="${current} of ${total}"><span style="--progress-value:${width}%"></span></div>`;
  }
  return `
    <div class="segmented-progress" aria-label="${current} of ${total}">
      <span class="segment is-complete"></span>
      <span class="segment ${current > total / 4 ? 'is-complete' : ''}"></span>
      <span class="segment ${current > total / 2 ? 'is-complete' : ''}"></span>
      <span class="segment ${current > total * 0.75 ? 'is-complete' : ''}"></span>
      <strong class="progress-current">${current}</strong>
      <strong class="progress-total">${total}</strong>
    </div>`;
}

export function modeRow({ iconName, label, route = '', badge = '' }) {
  const tag = route ? 'button' : 'div';
  const nav = route ? ` data-nav="${route}"` : '';
  const decorative = route ? '' : ' decorative-mode';
  return `
    <${tag} class="mode-row${decorative}"${nav}>
      <span class="mode-icon">${icon(iconName)}</span>
      <span class="mode-label">${label}</span>
      ${badge ? `<span class="badge">${badge}</span>` : ''}
    </${tag}>`;
}

export function answerButton(answer, index, className = '') {
  return `<button class="answer-card ${className}" data-answer="${index}">${answer}</button>`;
}

export function setListItem(set, index) {
  return `
    <button class="set-list-item" data-open-set="${index}">
      <span class="set-icon">${icon('set-cyan')}</span>
      <span class="set-copy">
        <strong>${set.chapter}</strong>
        <small>Flashcard set · ${set.terms.length} terms · by you</small>
      </span>
      <span class="set-more">${icon('more')}</span>
    </button>`;
}
