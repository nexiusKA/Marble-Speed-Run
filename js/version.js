// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '62',
    sha:    '7f1bc1267e2d02f5a58f76261ed1f1ea285661b7',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
