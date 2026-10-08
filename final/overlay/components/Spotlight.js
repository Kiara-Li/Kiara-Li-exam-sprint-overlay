// Dims the folder page and leaves only "Study all" lit, so a participant's
// first tap goes to the sprint entry point instead of into a single chapter.

export function spotlight() {
  return `
    <div class="ov-spotlight" data-ov="spotlight">
      <p class="ov-spotlight-hint">Studying for an exam?<span>Start here</span></p>
    </div>`;
}
