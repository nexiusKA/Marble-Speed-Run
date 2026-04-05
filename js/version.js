// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '20',
    sha:    'edd225efce5c40e0d85499692a4dbe904c8bbf5c',
    branch: 'main',
    date:   '2026-04-05',
  };
})();
