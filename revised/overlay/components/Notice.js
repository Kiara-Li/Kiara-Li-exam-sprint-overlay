// One look for every message the study screens show.
//
// - A toast says something happened. It needs no answer and fades after 3 s.
// - A sheet asks for a choice. It has a title, at most a short list or one
//   line, then the main choice as the primary button and the other as the
//   soft one.
//
// Both use the same round icon badge, so a message reads the same wherever
// it appears.
import { boltGlyph, checkGlyph } from './glyphs.js';

function icon(kind) {
  return kind === 'speed' ? boltGlyph() : kind === 'good' ? checkGlyph('ov-glyph-xs') : '<b aria-hidden="true">!</b>';
}

export function noticeBadge(kind = 'speed') {
  return `<span class="ov-notice-icon is-${kind}" aria-hidden="true">${icon(kind)}</span>`;
}

/** The inside of a toast. */
export function noticeToast(toast) {
  return toast ? `${noticeBadge(toast.kind)}<span>${toast.text}</span>` : '';
}

/** A short list for a sheet, one badge per line. */
export function noticeList(lines, kind = 'speed') {
  return `<ul class="ov-notice-list">${lines.map((line) => `<li>${noticeBadge(kind)}<span>${line}</span></li>`).join('')}</ul>`;
}

export function noticeLine(text) {
  return `<p class="ov-notice-line">${text}</p>`;
}
