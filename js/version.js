// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '76',
    sha:    'db01c7474fb81e57c5cf62793b2aa604b37d1203',
    branch: 'main',
    date:   '2026-04-12',
  };
})();
