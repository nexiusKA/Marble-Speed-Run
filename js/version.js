// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '112',
    sha:    'cc215f180904d518cab539bd7399e199458724ad',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
