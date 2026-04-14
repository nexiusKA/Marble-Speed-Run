// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '80',
    sha:    'ec8d0cc258ae9299c97bf764282ac84f71258bd1',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
