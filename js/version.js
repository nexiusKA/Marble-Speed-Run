// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '126',
    sha:    '4b4a04abb62f48e455c5e787a7915743ff544519',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
