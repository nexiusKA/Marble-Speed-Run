// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '30',
    sha:    'a89c0e09c185669cc1d8ac3616a2f0a33dcfdef2',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
