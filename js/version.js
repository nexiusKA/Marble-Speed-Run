// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '55',
    sha:    'a0d35903f8ae3284bf8cd1d3a67358d363ee6988',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
