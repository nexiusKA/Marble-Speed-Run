// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '116',
    sha:    '47873e06e151f53992165cd374d9ece26fb5904d',
    branch: 'main',
    date:   '2026-10-24',
  };
})();
