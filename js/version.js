// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '114',
    sha:    'e1f315ea84a440ff570e12a44224134754cd35ba',
    branch: 'main',
    date:   '2026-10-24',
  };
})();
