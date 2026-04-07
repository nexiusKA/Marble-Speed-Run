// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '53',
    sha:    'a5873dea3bea2e374c48cb4307218f6c62464ec5',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
