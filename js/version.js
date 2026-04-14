// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '85',
    sha:    '3d7cf54d1da0ef3d4767bf06a9e7055557548a7e',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
