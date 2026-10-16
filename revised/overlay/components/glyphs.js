// Two glyphs the base set does not contain, drawn in the same two-tone,
// rounded, flat style as the base mode icons and coloured from base tokens.

export function clockGlyph(className = 'ov-glyph') {
  return `
    <span class="${className}" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="18" fill="var(--color-cyan)" />
        <path d="M24 6a18 18 0 0 1 18 18" stroke="var(--color-primary)" stroke-width="6" stroke-linecap="round" />
        <path d="M24 13v11.5l7.5 5" stroke="var(--color-primary)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>`;
}

export function saveGlyph(className = 'ov-glyph-sm') {
  return `
    <span class="${className}" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 19V6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        <path d="M6.5 11.5 12 6l5.5 5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>`;
}

export function checkGlyph(className = 'ov-glyph-sm') {
  return `
    <span class="${className}" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="m6 12.5 4 4 8-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>`;
}
