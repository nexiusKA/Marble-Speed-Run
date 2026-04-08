// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '74',
    sha:    '9ecd0d8351bc008a802b809bd6576c13054313b5',
    branch: 'main',
    date:   '2026-04-08',
  };
})();
