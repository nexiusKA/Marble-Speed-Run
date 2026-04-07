// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '69',
    sha:    'fc70d4b5e2f84bd279a8c297c5933835dc9f7846',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
