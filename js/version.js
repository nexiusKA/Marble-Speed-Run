// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '102',
    sha:    '349a20511ea146c3a5073516e2a3db6706083551',
    branch: 'main',
    date:   '2026-10-16',
  };
})();
