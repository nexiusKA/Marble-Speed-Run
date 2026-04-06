// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '29',
    sha:    '1e6c3aa6174475ca242cc313f5144eff22d2140d',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
