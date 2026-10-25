// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '124',
    sha:    '8d74d0f8c9dacac70948e57aaf280006e00d954f',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
