// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '82',
    sha:    'c787c6bad167f919d44225697c29cf2f8c72bd6c',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
