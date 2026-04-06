// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '22',
    sha:    '38b7173e200d71ae9d51b5012f2893b435447a09',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
