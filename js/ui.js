// ── UI ───────────────────────────────────────────────────────────────────────

class UI {
  constructor() {
    this.distEl      = document.getElementById('dist-display');
    this.bestEl      = document.getElementById('best-display');
    this.voidDistEl  = document.getElementById('void-display');
    this.timerEl     = document.getElementById('timer-display');
    this.overlay     = document.getElementById('overlay');
    this.gameOverOvl = document.getElementById('gameover-overlay');
    this.goDistEl    = document.getElementById('go-dist');
    this.goBestEl    = document.getElementById('go-best');
    this.easyBtn     = document.getElementById('easy-btn');
    this.normalBtn   = document.getElementById('normal-btn');
    this.hardBtn     = document.getElementById('hard-btn');
    this.playBtn     = document.getElementById('play-btn');
    this.retryBtn    = document.getElementById('retry-btn');
  }

  showStart(onDifficulty, onPlay) {
    this._show(this.overlay);
    this._hide(this.gameOverOvl);
    const diffBtns = [this.easyBtn, this.normalBtn, this.hardBtn];
    const selectDiff = (btn, pct) => {
      diffBtns.forEach(b => b.classList.remove('difficulty-selected'));
      btn.classList.add('difficulty-selected');
      onDifficulty(pct);
    };
    this.easyBtn.onclick   = () => selectDiff(this.easyBtn,   125);
    this.normalBtn.onclick = () => selectDiff(this.normalBtn, 150);
    this.hardBtn.onclick   = () => selectDiff(this.hardBtn,   175);
    this.playBtn.onclick   = () => { this._hide(this.overlay); onPlay(); };
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

  updateVoidDistance(m) {
    if (this.voidDistEl) this.voidDistEl.textContent = m;
  }

  updateBestDistance(m) {
    if (this.bestEl) this.bestEl.textContent = m === 0 ? '--' : `${m} m`;
  }

  updateTimer(ms) {
    if (!this.timerEl) return;
    const totalS = ms / 1000;
    const mins   = Math.floor(totalS / 60);
    const secs   = (totalS % 60).toFixed(1).padStart(4, '0');
    this.timerEl.textContent = `${mins}:${secs}`;
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
