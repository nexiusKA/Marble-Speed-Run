// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '60',
    sha:    '8c64fd80ebfe7d95d9b2ec83e234d26d6dcd6e58',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
