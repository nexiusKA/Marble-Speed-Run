// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '19',
    sha:    '7dbd18def09e45a31627eabcf3aff3e491de1651',
    branch: 'main',
    date:   '2026-04-05',
  };
})();
