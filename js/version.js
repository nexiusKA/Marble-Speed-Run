// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '73',
    sha:    '6a4be61223bbdf9905373b5d27c61e83c73c8869',
    branch: 'main',
    date:   '2026-04-08',
  };
})();
