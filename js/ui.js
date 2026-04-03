// ── UI ───────────────────────────────────────────────────────────────────────

class UI {
  constructor() {
    this.timerEl     = document.getElementById('timer-display');
    this.bestEl      = document.getElementById('best-display');
    this.overlay     = document.getElementById('overlay');
    this.finishOvl   = document.getElementById('finish-overlay');
    this.finishTime  = document.getElementById('finish-time');
    this.finishBest  = document.getElementById('finish-best');
    this.startBtn    = document.getElementById('start-btn');
    this.retryBtn    = document.getElementById('retry-btn');
  }

  showStart(onStart) {
    this._show(this.overlay);
    this._hide(this.finishOvl);
    this.startBtn.onclick = () => { this._hide(this.overlay); onStart(); };
  }

  showFinish(timeMs, bestMs, onRetry) {
    this._show(this.finishOvl);
    this.finishTime.textContent = `${(timeMs / 1000).toFixed(3)}s`;
    const isNew = bestMs === timeMs;
    this.finishBest.textContent = isNew
      ? '🏆 New Best!'
      : `Best: ${(bestMs / 1000).toFixed(3)}s`;
    this.retryBtn.onclick = () => { this._hide(this.finishOvl); onRetry(); };
  }

  hideFinish() {
    this._hide(this.finishOvl);
  }

  updateTimer(ms) {
    this.timerEl.textContent = (ms / 1000).toFixed(3);
  }

  updateBest(ms) {
    this.bestEl.textContent = ms === Infinity ? '--' : `${(ms / 1000).toFixed(3)}s`;
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
