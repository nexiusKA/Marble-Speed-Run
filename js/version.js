// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '24',
    sha:    '2d9abcd81ca8a7bca3b634e697992cef834c969d',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
