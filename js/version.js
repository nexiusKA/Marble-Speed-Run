// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '56',
    sha:    '6d5a9465b7a58235848cae8d176b25fc22f04f26',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
