// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '48',
    sha:    '5e005892251fa3b484c53b52235793eb99ceac70',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
