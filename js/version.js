// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '118',
    sha:    '5837775bc2fd12013c04b9943a74828b70085d72',
    branch: 'main',
    date:   '2026-10-25',
  };
})();
