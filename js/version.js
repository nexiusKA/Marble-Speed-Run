// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '68',
    sha:    '910514f937d0c98fdd64bcf588644de53a417494',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
