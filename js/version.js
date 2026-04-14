// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '84',
    sha:    '3403f2422d0eb8ca84e4cb435c8df3948a9bc386',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
