// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '42',
    sha:    'e0e244144b1a56fba86f96166db8d95c4459a43c',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
