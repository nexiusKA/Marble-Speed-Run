// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '15',
    sha:    'd111df2029afb58ba406ce8ce45a5f3da1a65de9',
    branch: 'main',
    date:   '2026-04-04',
  };
})();
