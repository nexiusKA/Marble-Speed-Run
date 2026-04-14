// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '81',
    sha:    '44637307e24a09ed82bc88cbe5baaea9c53c161e',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
