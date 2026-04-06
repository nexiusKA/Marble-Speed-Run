// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '33',
    sha:    '5960f2ded66fb9a43bc2f2b585be213da9073974',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
