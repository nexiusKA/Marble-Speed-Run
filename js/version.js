// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '43',
    sha:    '11c38a2130a3c25c21d6c7cd8776332ce073fb09',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
