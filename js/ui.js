// ── UI ───────────────────────────────────────────────────────────────────────

class UI {
  constructor() {
    this.distEl      = document.getElementById('dist-display');
    this.bestEl      = document.getElementById('best-display');
    this.overlay     = document.getElementById('overlay');
    this.gameOverOvl = document.getElementById('gameover-overlay');
    this.goDistEl    = document.getElementById('go-dist');
    this.goBestEl    = document.getElementById('go-best');
    this.startBtn    = document.getElementById('start-btn');
    this.retryBtn    = document.getElementById('retry-btn');
  }

  showStart(onStart) {
    this._show(this.overlay);
    this._hide(this.gameOverOvl);
    this.startBtn.onclick = () => { this._hide(this.overlay); onStart(); };
  }

  showGameOver(dist, best, isNew, onRetry) {
    this._show(this.gameOverOvl);
    this.goDistEl.textContent = `${dist} m`;
    this.goBestEl.textContent = isNew ? '🏆 New Best!' : `Best: ${best} m`;
    this.retryBtn.onclick = () => { this._hide(this.gameOverOvl); onRetry(); };
  }

  hideGameOver() {
    this._hide(this.gameOverOvl);
  }

  updateDistance(m) {
    if (this.distEl) this.distEl.textContent = m;
  }

  updateBestDistance(m) {
    if (this.bestEl) this.bestEl.textContent = m === 0 ? '--' : `${m} m`;
  }

  _show(el) {
    el.classList.remove('hidden');
    el.classList.add('visible');
  }

  _hide(el) {
    el.classList.remove('visible');
    el.classList.add('hidden');
  }
}
