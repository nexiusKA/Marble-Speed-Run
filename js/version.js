// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '88',
    sha:    '8c1aeb36fd013563231c2fd276c319ccf913e532',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
