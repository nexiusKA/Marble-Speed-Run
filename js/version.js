// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '101',
    sha:    'd27153d39be52e88d4133180bec78ebb84a257b9',
    branch: 'main',
    date:   '2026-10-16',
  };
})();
