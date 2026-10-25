// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '119',
    sha:    '35e20d3ad400a4f8536897c3fd898f467ace5ff8',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
