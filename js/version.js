// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '54',
    sha:    '913b51404a59ce90afa18f470ce7a84560819fc9',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
