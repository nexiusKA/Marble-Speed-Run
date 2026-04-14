// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '93',
    sha:    '3771196fca311b3ba28635cc0e7050a55c18b320',
    branch: 'main',
    date:   '2026-04-14',
  };
})();
