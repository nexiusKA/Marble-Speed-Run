// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '72',
    sha:    '984e339b117df0540bf7894cdede38c8c66b4337',
    branch: 'main',
    date:   '2026-04-08',
  };
})();
