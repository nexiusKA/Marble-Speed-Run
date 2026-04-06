// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '35',
    sha:    '282497a21aae9c96a8a4375520913b321513969f',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
