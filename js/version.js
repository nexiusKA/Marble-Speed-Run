// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    'dev',
    sha:    'dev',
    branch: 'dev',
    date:   'dev',
  };
})();
