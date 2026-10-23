// ── quality.js ───────────────────────────────────────────────────────────────
// Adaptive render quality. Canvas glow (shadowBlur) is by far the most
// expensive effect on phones. Instead of touching every draw call, the game's
// 2D context gets an instance-level `shadowBlur` setter that scales the value
// by `glowScale` (1 = full glow, 0 = no glow).
//
// Quality modes (persisted in localStorage 'mrFxQuality'):
//   'auto' (default) – start with full glow; if the game runs below ~45 fps for
//                      a couple of seconds while playing, switch to 'low' and
//                      remember that for this device.
//   'high'           – always full glow
//   'low'            – no glow
// The decision can be reset with localStorage.removeItem('mrFxQuality').

class RenderQuality {
  constructor(ctx) {
    this.mode = 'auto';
    this.glowScale = 1;
    this._intervals = [];
    this._decided = false;

    let stored = null;
    try { stored = localStorage.getItem('mrFxQuality'); } catch (_) { /* ignore */ }
    if (stored === 'high' || stored === 'low' || stored === 'auto') this.mode = stored;
    if (stored === 'auto-low') { this.mode = 'auto'; this._decided = true; this.glowScale = 0; }
    if (this.mode === 'low') this.glowScale = 0;

    this._patchShadowBlur(ctx);
  }

  _patchShadowBlur(ctx) {
    const desc = ctx && Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'shadowBlur');
    if (!desc || !desc.set || !desc.get) return;
    const self = this;
    try {
      Object.defineProperty(ctx, 'shadowBlur', {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, self.glowScale === 1 ? v : v * self.glowScale); },
      });
    } catch (_) { /* leave context untouched */ }
  }

  get isLow() { return this.glowScale === 0; }

  /**
   * Feed the real frame interval (seconds, uncapped) while gameplay is running.
   * After ~3 s of samples decides once whether the device needs low quality.
   */
  sample(intervalSec, playing) {
    if (this.mode !== 'auto' || this._decided || !playing) return;
    if (!(intervalSec > 0) || intervalSec > 0.25) return; // ignore pauses / tab switches
    this._intervals.push(intervalSec);
    if (this._intervals.length < 180) return;

    const sorted = this._intervals.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this._intervals = [];
    if (median > 1 / 45) {
      this.glowScale = 0;
      this._decided = true;
      try { localStorage.setItem('mrFxQuality', 'auto-low'); } catch (_) { /* ignore */ }
      if (typeof console !== 'undefined') console.info('[Marble Rush] Low frame rate detected – glow effects reduced');
    } else {
      this._decided = true; // device is fast enough, stop measuring
    }
  }
}
