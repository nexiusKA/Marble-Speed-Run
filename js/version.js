// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '26',
    sha:    '6a8cc6bf77e59e40f70302a20fefec3ee2dd9ea3',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
