// ── Main entry point ─────────────────────────────────────────────────────────

// ── Build info display ───────────────────────────────────────────────────────
// Populate the git-info <details> block and version tag from BUILD_INFO
// (defined in js/version.js, which CI overwrites on each build).
(function initBuildInfo() {
  if (typeof BUILD_INFO === 'undefined') return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const sha7 = BUILD_INFO.sha.length > 7 ? BUILD_INFO.sha.slice(0, 7) : BUILD_INFO.sha;
  set('gi-run',    BUILD_INFO.run);
  set('gi-sha',    sha7);
  set('gi-branch', BUILD_INFO.branch);
  set('gi-date',   BUILD_INFO.date);
  if (BUILD_INFO.run !== 'dev') {
    // Players don't need the build details; keep them reachable via ?debug
    const showBuildInfo = new URLSearchParams(location.search).has('debug');
    const gitInfo = document.getElementById('git-info');
    if (gitInfo && !showBuildInfo) gitInfo.style.display = 'none';
    const tag = document.getElementById('version-tag');
    // Keep the version stamped into the HTML by scripts/build.js (from package.json)
    if (tag) tag.textContent = `${tag.textContent.trim().split(' ')[0]} #${BUILD_INFO.run} ${sha7}`;
  }
})();

// ── Responsive scaling ───────────────────────────────────────────────────────
// Scale the fixed-size game container to always fit the viewport.
// The container is 480 × (CANVAS_H + CONTROLS_H) logical px, where CANVAS_H
// follows the screen's aspect ratio (track.js), so we only need to scale the
// outer container — no game-logic coordinates change.
(function initScaleAndFullscreen() {
  const container = document.getElementById('game-container');
  const canvasEl  = document.getElementById('gameCanvas');
  const fsBtn     = document.getElementById('fullscreen-btn');
  const logicalH  = CANVAS_H + CONTROLS_H;

  container.style.height = logicalH + 'px';
  canvasEl.style.height  = CANVAS_H + 'px';

  function updateScale() {
    // body padding holds the safe-area insets (status bar, notch, gesture bar)
    const bodyStyle = getComputedStyle(document.body);
    const padY   = (parseFloat(bodyStyle.paddingTop) || 0) + (parseFloat(bodyStyle.paddingBottom) || 0);
    const scaleX = window.innerWidth  / 480;
    const scaleY = (window.innerHeight - padY) / logicalH;
    const scale  = Math.min(scaleX, scaleY, 1); // never upscale on desktop
    container.style.transform = `scale(${scale})`;
    container.style.visibility = 'visible'; // hidden in CSS until first scaled (no zoomed-in flash on slow devices)
  }

  // Fullscreen helpers with Safari prefix support
  function enterFullscreen() {
    const el = document.documentElement;
    return (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  }
  function leaveFullscreen() {
    return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
  function isFullscreen() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  fsBtn.addEventListener('click', () => {
    if (isFullscreen()) {
      leaveFullscreen();
    } else {
      enterFullscreen().catch(() => {});
    }
  });

  // SVG icon polylines for expand / compress states
  const ICON_EXPAND   = '<polyline points="0,4 0,0 4,0"/>' +
                        '<polyline points="10,0 14,0 14,4"/>' +
                        '<polyline points="14,10 14,14 10,14"/>' +
                        '<polyline points="4,14 0,14 0,10"/>';
  const ICON_COMPRESS = '<polyline points="4,0 4,4 0,4"/>' +
                        '<polyline points="14,4 10,4 10,0"/>' +
                        '<polyline points="10,14 10,10 14,10"/>' +
                        '<polyline points="0,10 4,10 4,14"/>';

  function updateFsIcon() {
    const icon = document.getElementById('fs-icon');
    if (icon) icon.innerHTML = isFullscreen() ? ICON_COMPRESS : ICON_EXPAND;
  }

  function onFullscreenChange() {
    if (isFullscreen()) {
      fsBtn.title = 'Exit fullscreen';
      fsBtn.setAttribute('aria-label', 'Exit fullscreen');
    } else {
      fsBtn.title = 'Enter fullscreen';
      fsBtn.setAttribute('aria-label', 'Enter fullscreen');
    }
    updateFsIcon();
    updateScale();
  }

  document.addEventListener('fullscreenchange',       onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  window.addEventListener('resize',                   updateScale);
  // No optional chaining here: older Android WebViews (Chrome < 80) reject
  // the syntax and the whole script would fail to load (black screen).
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', updateScale);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateScale);
  }

  // Block browser zoom (Ctrl+scroll and Ctrl++/-/0) so the page layout
  // doesn't break the fixed-size game container.
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
    }
  });

  updateScale();
  // In the Android WebView the viewport size is sometimes not final when the
  // scripts run (the game showed up zoomed in until the first resize), so
  // re-measure once the page has loaded and shortly after.
  window.addEventListener('load', updateScale);
  [100, 500, 1500].forEach((ms) => setTimeout(updateScale, ms));
})();

(function () {
  const canvas = document.getElementById('gameCanvas');
  const game   = new Game(canvas);
  if (window.MarbleNative) window.MarbleNative.setGame(game);

  // Pause sound / gameplay when the page is hidden (tab switch, app in
  // background). Android additionally reports this via native.js.
  const onVisibility = () => {
    if (document.hidden) game.onAppHidden(); else game.onAppVisible();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => game.onAppHidden());
  window.addEventListener('pageshow', () => { if (!document.hidden) game.onAppVisible(); });
  // Exposed for automated browser tests (tests/e2e.test.js)
  window.__marbleGame = game;

  let lastTime  = null;
  let fpsAccum  = 0;   // seconds accumulated for FPS averaging
  let fpsCount  = 0;   // frames counted in this window
  let crashed   = false;
  let rafId     = 0;
  let lastState = game.state;
  if (window.MarbleNative) window.MarbleNative.onGameStateChange(lastState);

  function showCrashScreen(err) {
    const ctx = game.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ff4444';
    ctx.font         = 'bold 20px monospace';
    ctx.fillText('⚠ Game Error', CANVAS_W / 2, CANVAS_H / 2 - 44);
    ctx.fillStyle = '#ffaaaa';
    ctx.font      = '13px monospace';
    // Wrap long messages at ~38 chars
    const msg   = String(err && err.message ? err.message : err);
    const words = msg.split(' ');
    let   line  = '';
    let   lineY = CANVAS_H / 2 - 14;
    for (const word of words) {
      if ((line + word).length > 38) {
        ctx.fillText(line.trim(), CANVAS_W / 2, lineY);
        lineY += 18;
        line   = '';
      }
      line += word + ' ';
    }
    if (line.trim()) ctx.fillText(line.trim(), CANVAS_W / 2, lineY);
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 18px sans-serif';
    ctx.fillText('Tap to restart', CANVAS_W / 2, CANVAS_H / 2 + 70);
    ctx.restore();
    // Players can't open a console on a phone – a tap reloads the game.
    // Progress (best distance, coins, achievements) lives in localStorage.
    game.canvas.addEventListener('pointerdown', () => location.reload(), { once: true });
  }

  function loop(timestamp) {
    if (crashed) return;
    if (document.hidden) {
      lastTime = null;
      rafId = 0;
      return;
    }

    try {
      if (lastTime === null) lastTime = timestamp;
      const rawDt = (timestamp - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05); // cap at 50ms
      lastTime  = timestamp;
      if (game.quality) game.quality.sample(rawDt, game.state === 'running');

      // Rolling FPS — update display every 0.5 s
      fpsAccum += dt;
      fpsCount += 1;
      if (fpsAccum >= 0.5) {
        game.fps  = Math.round(fpsCount / fpsAccum);
        fpsAccum  = 0;
        fpsCount  = 0;
      }

      game.update(dt);
      game.render();
      if (game.state !== lastState) {
        lastState = game.state;
        if (window.MarbleNative) window.MarbleNative.onGameStateChange(lastState);
      }
    } catch (err) {
      crashed = true;
      console.error('[Marble Rush] Fatal error in game loop:', err);
      showCrashScreen(err);
      return; // stop the loop
    }

    rafId = requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      lastTime = null;
      return;
    }
    if (!crashed && !rafId) {
      rafId = requestAnimationFrame(loop);
    }
  });

  rafId = requestAnimationFrame(loop);
})();
