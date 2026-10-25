// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '117',
    sha:    '315583fbb22b15ba5251db989b2e63b6352fb222',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
