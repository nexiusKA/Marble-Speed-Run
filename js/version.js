// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '98',
    sha:    'a9ff427d7f06c57a7a78ed76cb057817cd2d3a66',
    branch: 'main',
    date:   '2026-10-15',
  };
})();
