// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '99',
    sha:    '989b771939061ecedd3af4618f6665e82d5364d9',
    branch: 'main',
    date:   '2026-10-15',
  };
})();
