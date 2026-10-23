// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '109',
    sha:    '44f06d74f58c87552245c68e89bc51380240fd2b',
    branch: 'main',
    date:   '2026-10-23',
  };
})();
