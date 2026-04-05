// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '18',
    sha:    'f947de63b5134c40a08dd9d4e13b3cac3d6fe029',
    branch: 'main',
    date:   '2026-04-05',
  };
})();
