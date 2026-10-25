// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '120',
    sha:    '0be24d566271453dc9ddde3151366910df9c1fd5',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
