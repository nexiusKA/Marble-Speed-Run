// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '58',
    sha:    '193271f6782e7fe4eed1ed6d027a7a667f3ba42f',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
