// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '57',
    sha:    '11b80c92079d033b2652a41b9c25c62e44babc24',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
