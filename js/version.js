// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '65',
    sha:    'd306e86cbdc859f41d93c6c80587785350a81735',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
