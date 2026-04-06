// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '23',
    sha:    '67d717d901dcc52caa6443d14e2daf38d4c114d1',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
