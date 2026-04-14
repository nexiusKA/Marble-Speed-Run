// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '95',
    sha:    '497f8cd5da8605b78f1752d7f937ddebea0e471b',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
