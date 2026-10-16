// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '100',
    sha:    '6f383b095e891f1325b052ad05236f326e4b241d',
    branch: 'main',
    date:   '2026-10-16',
  };
})();
