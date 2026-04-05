// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '21',
    sha:    '9506ce6ea8f4ffb577698b76696505dd5935c609',
    branch: 'main',
    date:   '2026-04-05',
  };
})();
