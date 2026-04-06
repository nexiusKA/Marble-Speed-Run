// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '45',
    sha:    'f7353434de080e20e94230d9681ff680c88bd7d4',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
