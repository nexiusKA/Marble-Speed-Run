// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '66',
    sha:    'ce433185e528ff6b6e6b00291c4ba1709fe6499f',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
