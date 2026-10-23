// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '106',
    sha:    '59ce15fd30cfc7cb79608cadb11cf0606d11ec4d',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
