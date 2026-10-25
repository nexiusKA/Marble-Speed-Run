// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '125',
    sha:    '418d14833806615add85b72b05afcd07a510ab5e',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
