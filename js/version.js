// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '64',
    sha:    '4771e103d814f3c03f798607147a02b48ad9d7dc',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
