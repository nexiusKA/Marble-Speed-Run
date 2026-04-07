// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '67',
    sha:    '8d544b9ae022b328ba5214ab7cabea833f85e7b7',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
