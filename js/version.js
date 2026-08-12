// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '96',
    sha:    '84c9a56c6e4535ec7c7727fcd6becfb01e7b32f2',
    branch: 'main',
    date:   '2026-08-12',
  };
})();
