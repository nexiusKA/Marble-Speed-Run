// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '113',
    sha:    'adde9a983c444f2082a1eb96dbf7c24abd69c421',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
