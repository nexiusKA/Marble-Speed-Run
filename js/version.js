// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '105',
    sha:    '417fb53b352b58c9176fc9855f2e662cc5d0d643',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
