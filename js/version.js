// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '92',
    sha:    '9ddb712cc2ad7bb2e1b42da5ed31d6e8394a7438',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
