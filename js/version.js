// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '123',
    sha:    'c6ae3dded663c4193c0291e26156daa438c82129',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
