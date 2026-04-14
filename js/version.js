// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '79',
    sha:    '7c6d201d4fcac04eb524f6df1c417c87c270700b',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
