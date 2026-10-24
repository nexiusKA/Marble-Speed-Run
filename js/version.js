// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '115',
    sha:    '9d1e4aa4d433cba98245b89f9c0dd5f656403ebb',
    branch: 'main',
    date:   '2026-10-24',
  };
})();
