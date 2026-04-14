// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '89',
    sha:    'b6f728221465ca172b1a127c6f2ce57b899ba116',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
