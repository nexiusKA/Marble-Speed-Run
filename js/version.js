// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '44',
    sha:    '43f9c9ed35ae0364b628a81d3c9f1e61e0c29aa3',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
