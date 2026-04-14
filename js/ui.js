// ── UI ───────────────────────────────────────────────────────────────────────

class UI {
  constructor() {
    this.distEl      = document.getElementById('dist-display');
    this.bestEl      = document.getElementById('best-display');
    this.voidDistEl  = document.getElementById('void-display');
    this.timerEl     = document.getElementById('timer-display');
    this.coinEl      = document.getElementById('coin-display');
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

  showGameOver(baseDist, totalDist, best, isNew, coins, coinBonus, onRetry) {
    this._show(this.gameOverOvl);
    this.goDistEl.textContent = `${baseDist} m`;
    this.goBestEl.textContent = isNew ? '🏆 New Best!' : `Best: ${best} m`;

    const breakdownEl = document.getElementById('go-coin-breakdown');
    const coinsEl     = document.getElementById('go-coins');
    const bonusEl     = document.getElementById('go-bonus');
    const totalEl     = document.getElementById('go-total');

    if (breakdownEl && coinsEl && bonusEl && totalEl) {
      if (coins > 0) {
        // Reset visibility before animating
        coinsEl.style.opacity = '0';
        bonusEl.style.opacity = '0';
        totalEl.style.opacity = '0';
        coinsEl.textContent = `💰 ${coins} coin${coins !== 1 ? 's' : ''} × ${COIN_VALUE} m`;
        bonusEl.textContent = `= +${coinBonus} m bonus`;
        totalEl.textContent = `TOTAL: ${totalDist} m`;
        breakdownEl.classList.remove('hidden');

        // Staggered fade-in for each line
        this._fadeInAfter(coinsEl, 500);
        this._fadeInAfter(bonusEl, 1000);
        this._fadeInAfter(totalEl, 1500);
      } else {
        breakdownEl.classList.add('hidden');
      }
    }

    this.retryBtn.onclick = () => { this._hide(this.gameOverOvl); onRetry(); };
  }

  /** Fade an element from opacity 0 → 1 after `delayMs` milliseconds. */
  _fadeInAfter(el, delayMs) {
    el.style.transition = 'none';
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(6px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      el.style.opacity    = '1';
      el.style.transform  = 'translateY(0)';
    }, delayMs);
  }

  showPvpResult(playerWon, rankings, onRetry, onMenu) {
    const overlay   = document.getElementById('pvp-overlay');
    const titleEl   = document.getElementById('pvp-result-title');
    const subEl     = document.getElementById('pvp-result-sub');
    const rankEl    = document.getElementById('pvp-rankings');
    const retryBtn  = document.getElementById('pvp-retry-btn');
    const menuBtn   = document.getElementById('pvp-menu-btn');

    if (titleEl) {
      titleEl.textContent = playerWon ? '🏆 YOU WIN!' : '💀 YOU LOSE!';
      titleEl.className   = `pvp-result-title ${playerWon ? 'win' : 'lose'}`;
    }
    if (subEl) {
      const winner = rankings[0];
      subEl.textContent = winner && winner.finished
        ? (playerWon ? `You finished in ${UI._formatTime(winner.time)}!` : 'Better luck next time!')
        : (playerWon ? 'You crushed the opposition!' : 'Better luck next time!');
    }
    if (rankEl) {
      rankEl.innerHTML = '';
      const medals = ['🥇', '🥈', '🥉', '4️⃣'];
      rankings.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = `pvp-rank-row rank-${i + 1}`;
        const statText = r.finished ? UI._formatTime(r.time) : `${r.dist} m`;
        row.innerHTML =
          `<span class="pvp-rank-medal">${medals[i]}</span>` +
          `<span class="pvp-rank-name">${r.name}</span>` +
          `<span class="pvp-rank-dist">${statText}</span>`;
        rankEl.appendChild(row);
      });
    }
    if (retryBtn) retryBtn.onclick = () => { this._hide(overlay); onRetry(); };
    if (menuBtn)  menuBtn.onclick  = () => { this._hide(overlay); onMenu();  };
    if (overlay)  this._show(overlay);
  }

  /** Show/hide HUD elements that are only relevant in normal (non-PvP) mode. */
  setPvpHud(isPvp) {
    const ids = ['hud-dist', 'hud-coins', 'shop-btn', 'hud-void', 'hud-best'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', isPvp);
    }
  }

  /** Format milliseconds as M:SS.T (e.g. 1:23.4). */
  static _formatTime(ms) {
    const totalS = ms / 1000;
    const mins   = Math.floor(totalS / 60);
    const secs   = (totalS % 60).toFixed(1).padStart(4, '0');
    return `${mins}:${secs}`;
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

  updateCoinCount(n) {
    if (this.coinEl) this.coinEl.textContent = n;
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
