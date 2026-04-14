// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '77',
    sha:    '023e8347517b8605d8baeb03c356dbed1712c0f3',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
