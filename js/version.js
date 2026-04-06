// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '28',
    sha:    '5dca8ea4c021d495db85850534a69fa0b96d1ea5',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
