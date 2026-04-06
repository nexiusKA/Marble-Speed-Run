// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '41',
    sha:    '0bec338b6c68e25071b5ce190bd916a9a1b2e7b4',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
