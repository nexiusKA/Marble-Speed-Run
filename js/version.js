// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '16',
    sha:    'c0a9a0e525ad731f38b8be8a0bee7ac992c82367',
    branch: 'main',
    date:   '2026-04-04',
  };
})();
