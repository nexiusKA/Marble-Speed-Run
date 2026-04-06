// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '50',
    sha:    'ef241339b9f4d880b9acf81b703f411820b93f2a',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
