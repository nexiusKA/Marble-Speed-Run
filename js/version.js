// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '70',
    sha:    '9b6561ac0d6a8cb20ad4f3041164c22e9d96a87e',
    branch: 'main',
    date:   '2026-04-08',
  };
})();
