// ── Main entry point ─────────────────────────────────────────────────────────

(function () {
  const canvas = document.getElementById('gameCanvas');
  const game   = new Game(canvas);

  let lastTime = null;

  function loop(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime  = timestamp;

    game.update(dt);
    game.render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
