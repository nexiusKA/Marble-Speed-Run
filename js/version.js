// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '17',
    sha:    'e2989275405faee7182a9f1ea42580f5376190cd',
    branch: 'main',
    date:   '2026-04-05',
  };
})();
