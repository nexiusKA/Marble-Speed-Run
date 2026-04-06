// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '39',
    sha:    'e7ef8baea1cdaffef00a76d2bbf69f7199bc4129',
    branch: 'main',
    date:   '2026-04-06',
  };
})();
