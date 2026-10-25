// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '121',
    sha:    'd39e8d4daf16a7d1abd5e248c4c0c7d4714f34bd',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
