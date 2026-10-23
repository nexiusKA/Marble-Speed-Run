// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '108',
    sha:    '7db808f5e4d249106e778e5458a05368bf1920b5',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
