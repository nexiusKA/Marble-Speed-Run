// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '122',
    sha:    '5292be1441d4e8e8cd86871e9acd98a852e94f61',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
