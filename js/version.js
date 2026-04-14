// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '83',
    sha:    'd4a5fd74734ac100ca004fe770d06b4d185d60b2',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
