// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '52',
    sha:    'cea971d91e54962608d020e2d26080aa0c87671e',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
