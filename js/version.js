// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '103',
    sha:    'b765bdf6767cbc99d1c0099bbf5a5ddc403dd9fc',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
