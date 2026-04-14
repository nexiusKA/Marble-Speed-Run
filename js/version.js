// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '90',
    sha:    'e18d6ebfc2a78fcf64f5922362a4b80652467895',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
