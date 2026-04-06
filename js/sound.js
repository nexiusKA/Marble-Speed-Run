// ── Sound Manager ────────────────────────────────────────────────────────────
// Manages background music for Marble Rush.
// Creates the Audio object entirely in JavaScript so there is no hidden
// autoplay element in the HTML.  Music begins the first time start() is
// called, which must happen inside a user-gesture handler (START / PLAY AGAIN
// button clicks) to satisfy browser autoplay policies.

class SoundManager {
  constructor(volume, muted) {
    this._volume  = Math.max(0, Math.min(100, volume || 70));
    this._muted   = !!muted;
    this._started = false;

    this._audio        = new Audio('vacation_synth.mp3');
    this._audio.loop   = true;
    this._audio.volume = this._effectiveVolume();

    this._audio.addEventListener('error', () => {
      console.warn('[Audio] Failed to load vacation_synth.mp3:', this._audio.error);
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────

  // Call once (and on every PLAY AGAIN) inside a click handler.
  // Safe to call multiple times – resumes only when actually paused.
  start() {
    this._started = true;
    this._audio.volume = this._effectiveVolume();
    if (!this._muted && this._volume > 0 && this._audio.paused) {
      this._audio.play().catch(err => {
        console.warn('[Audio] play() failed:', err);
      });
    }
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(100, v));
    this._audio.volume = this._effectiveVolume();
    // Resume if the music was silenced by dragging volume to zero and back
    if (this._started && !this._muted && this._volume > 0 && this._audio.paused) {
      this._audio.play().catch(() => {});
    }
  }

  setMuted(muted) {
    this._muted = !!muted;
    this._audio.volume = this._effectiveVolume();
    if (this._started && !this._muted && this._volume > 0 && this._audio.paused) {
      this._audio.play().catch(() => {});
    }
  }

  get volume() { return this._volume; }
  get muted()  { return this._muted;  }

  // ── Private ──────────────────────────────────────────────────────────────

  _effectiveVolume() {
    return (!this._muted && this._volume > 0) ? this._volume / 100 : 0;
  }
}
