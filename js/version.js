// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '37',
    sha:    '7992a592a4bd7d63ad69b1f16206406afa91a38c',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
