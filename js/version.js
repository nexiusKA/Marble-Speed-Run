// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '63',
    sha:    '499b9a3a241e141fc1599605acb1763b2e164394',
    branch: 'main',
    date:   '2026-04-07',
  };
})();
