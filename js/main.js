// ── Main entry point ─────────────────────────────────────────────────────────

// ── Responsive scaling ───────────────────────────────────────────────────────
// Scale the fixed-size game container to always fit the viewport.
// The game uses a fixed 480×792 logical canvas, so we only need to scale the
// outer container — no game-logic coordinates change.
(function initScaleAndFullscreen() {
  const container = document.getElementById('game-container');
  const fsBtn     = document.getElementById('fullscreen-btn');

  function updateScale() {
    const scaleX = window.innerWidth  / 480;
    const scaleY = window.innerHeight / 792;
    const scale  = Math.min(scaleX, scaleY, 1); // never upscale on desktop
    container.style.transform = `scale(${scale})`;
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
  screen.orientation?.addEventListener('change', updateScale);

  updateScale();
})();

(function () {
  const canvas = document.getElementById('gameCanvas');
  const game   = new Game(canvas);

  let lastTime  = null;
  let fpsAccum  = 0;   // seconds accumulated for FPS averaging
  let fpsCount  = 0;   // frames counted in this window
  let crashed   = false;

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
    ctx.fillStyle = '#888888';
    ctx.font      = '12px monospace';
    ctx.fillText('Open console (F12) for details', CANVAS_W / 2, CANVAS_H / 2 + 60);
    ctx.fillText('Refresh the page to restart', CANVAS_W / 2, CANVAS_H / 2 + 78);
    ctx.restore();
  }

  function loop(timestamp) {
    if (crashed) return;

    try {
      if (lastTime === null) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
      lastTime  = timestamp;

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
    } catch (err) {
      crashed = true;
      console.error('[Marble Rush] Fatal error in game loop:', err);
      showCrashScreen(err);
      return; // stop the loop
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
