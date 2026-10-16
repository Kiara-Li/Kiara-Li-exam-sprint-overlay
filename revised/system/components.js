// Small renderers shared by production screens and the system gallery.
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function actionButton({ label, variant = 'primary', compact = false, action = '', disabled = false, loading = false } = {}) {
  const classes = { primary: 'primary-button', secondary: 'soft-button', text: 'ov-text-button' };
  return `<button type="button" class="${classes[variant] || classes.primary}${compact ? ' button-compact' : ''}"${action ? ` data-ov="${escape(action)}"` : ''}${disabled || loading ? ' disabled' : ''}${loading ? ' aria-busy="true"' : ''}>${loading ? '<span class="button-spinner" aria-hidden="true"></span>' : ''}${escape(label)}</button>`;
}

export function choiceChip({ label, action = '', key, chapter, selected = false, disabled = false } = {}) {
  return `<button type="button" class="ov-chip${selected ? ' is-selected' : ''}" aria-pressed="${selected}"${action ? ` data-ov="${escape(action)}"` : ''}${key !== undefined ? ` data-key="${escape(key)}"` : ''}${chapter !== undefined ? ` data-chapter="${Number(chapter)}"` : ''}${disabled ? ' disabled' : ''}>${escape(label)}</button>`;
}
