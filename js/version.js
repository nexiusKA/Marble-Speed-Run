// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '59',
    sha:    '4a5f140a3c01f0a6292cb2e4a66c6abfd6630a42',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
