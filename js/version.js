// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '25',
    sha:    '537d004db64107a4ff37b7cc73fb5c668ab91ad6',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
