// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '46',
    sha:    '3bae69ba7087bd919e4088e4aea4b44148755dbb',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
