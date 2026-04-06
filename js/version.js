// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '27',
    sha:    '6e71f8d74d51b65349e2e219307f2f8deb769bbd',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
