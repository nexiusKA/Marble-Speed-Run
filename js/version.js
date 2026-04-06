// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '31',
    sha:    '4c55edbd455f70203d2fb59d80640098d05e3258',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
