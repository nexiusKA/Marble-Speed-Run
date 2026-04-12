// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '75',
    sha:    '1ef31827f6711c0f161be42412a84b7bcc376930',
    branch: 'main',
    date:   '2026-04-12',
  };
})();
