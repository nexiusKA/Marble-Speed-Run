// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '104',
    sha:    '72e1f2eefa408d9dc7c26a7896ea77f83e6c12a1',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
