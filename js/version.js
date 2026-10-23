// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '111',
    sha:    '75697728a7ac92cde1ef27f970ab83fc4425ca01',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
