// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '38',
    sha:    'f68e1ad0bf69b6b89fe0bdc118623a7c98c1407f',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
