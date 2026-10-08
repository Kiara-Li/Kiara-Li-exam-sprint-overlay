// Reserved integration point. The overlay decides for itself whether to
// activate, so the base never needs to know which mode is running.
import('../overlay/index.js').catch(() => {
  /* No overlay layer present: the base runs on its own. */
});
