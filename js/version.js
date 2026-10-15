// ── version.js ───────────────────────────────────────────────
// Build metadata — overwritten by CI on each release build.
// In local dev this file is used as-is (all fields read "dev").
const BUILD_INFO = (function () {
  return {
    run:    '97',
    sha:    '871cc14ddd323b4cf8e15a688108965b2bab7029',
    branch: 'main',
    date:   '2026-10-15',
  };
})();
