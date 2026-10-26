// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '127',
    sha:    'f15638f19eeef40c2033f448246bd16e13ef6744',
    branch: 'main',
    date:   '2026-10-26',
  };
})();
