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

    this._audioCtx = null;
  }

  // ── Lazy AudioContext (respects browser autoplay rules) ──────────────────
  _getAudioCtx() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
    return this._audioCtx;
  }

  // Short electric-zap burst (played on each gate pass)
  playZap() {
    if (this._muted || this._volume === 0) return;
    try {
      const ac  = this._getAudioCtx();
      const vol = (this._volume / 100) * 0.35;
      const len = Math.floor(ac.sampleRate * 0.07); // 70 ms of noise

      const buf  = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len); // decaying white noise
      }

      const src = ac.createBufferSource();
      src.buffer = buf;

      const bpf = ac.createBiquadFilter();
      bpf.type            = 'bandpass';
      bpf.frequency.value = 2400;
      bpf.Q.value         = 1.2;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);

      src.connect(bpf);
      bpf.connect(gain);
      gain.connect(ac.destination);
      src.start();
    } catch (_) { /* ignore audio errors */ }
  }

  // Dramatic power-rush start whoosh
  playPowerRushStart() {
    if (this._muted || this._volume === 0) return;
    try {
      const ac  = this._getAudioCtx();
      const vol = (this._volume / 100) * 0.5;
      const len = Math.floor(ac.sampleRate * 0.25); // 250 ms

      const buf  = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t    = i / len;
        const env  = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9; // quick attack, slow decay
        data[i] = (Math.random() * 2 - 1) * env;
      }

      const src = ac.createBufferSource();
      src.buffer = buf;

      const bpf = ac.createBiquadFilter();
      bpf.type            = 'bandpass';
      bpf.frequency.value = 1000;
      bpf.frequency.linearRampToValueAtTime(3000, ac.currentTime + 0.25);
      bpf.Q.value         = 0.8;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);

      src.connect(bpf);
      bpf.connect(gain);
      gain.connect(ac.destination);
      src.start();
    } catch (_) { /* ignore audio errors */ }
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
