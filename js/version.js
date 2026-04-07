// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '61',
    sha:    '190972ab43bcbee1b40595538e86362895c27c13',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
