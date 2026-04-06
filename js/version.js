// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '34',
    sha:    'fe547a3e22820bb423c600f89f241794d4456617',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
