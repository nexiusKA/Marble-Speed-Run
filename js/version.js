// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '32',
    sha:    '47a6591f7d04ef345dff86469e2b995a0f1d4065',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
