// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '94',
    sha:    '75ee76978ece453b26bf94576d6acc776290dd5e',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
