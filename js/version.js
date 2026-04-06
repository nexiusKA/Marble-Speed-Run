// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '51',
    sha:    'b4548581001a74333bcc88974c8a1f8486815920',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
