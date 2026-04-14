// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '78',
    sha:    '3a8bcc9b9a86a7337ac9ffc274297a8aee170969',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
