// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '36',
    sha:    '26c7304c0a8e4bf1e2c6d21313d1aa1056f80110',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
