// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '40',
    sha:    '5c7339a0a1a0aeb8f27e33160d715389643cb4ab',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
