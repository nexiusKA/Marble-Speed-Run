// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '110',
    sha:    'dc97a5abf74d9dc0500dbe329c94c51263bbc894',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
