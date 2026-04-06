// ── Sound Manager ────────────────────────────────────────────────────────────
// Manages background music for Marble Rush.
// Creates the Audio object entirely in JavaScript so there is no hidden
// autoplay element in the HTML.  Music begins the first time start() is
// called, which must happen inside a user-gesture handler (START / PLAY AGAIN
// button clicks) to satisfy browser autoplay policies.
//
// All music tracks live in the sounds/ folder.  A random track is chosen at
// the start of each run; when a track ends the next random track begins.

const MUSIC_TRACKS = [
  'sounds/adventure.mp3',
  'sounds/flowerhunt.mp3',
  'sounds/nightfall.mp3',
  'sounds/ride_the_wave.mp3',
  'sounds/sunfall.mp3',
  'sounds/vacation_synth.mp3',
];

class SoundManager {
  constructor(volume, muted) {
    this._volume  = Math.max(0, Math.min(100, volume || 70));
    this._muted   = !!muted;
    this._started = false;

    this._trackIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
    this._audio        = new Audio(MUSIC_TRACKS[this._trackIndex]);
    this._audio.loop   = false;
    this._audio.volume = this._effectiveVolume();

    this._audio.addEventListener('error', () => {
      console.warn('[Audio] Failed to load track:', this._audio.src, this._audio.error);
    });

    // When a track finishes, pick a different random track and continue.
    this._audio.addEventListener('ended', () => {
      this._playNextTrack();
    });

    this._audioCtx = null;
  }

  // Pick a random track that is different from the current one.
  _playNextTrack() {
    let next;
    do {
      next = Math.floor(Math.random() * MUSIC_TRACKS.length);
    } while (MUSIC_TRACKS.length > 1 && next === this._trackIndex);
    this._trackIndex = next;
    this._audio.src  = MUSIC_TRACKS[this._trackIndex];
    this._audio.volume = this._effectiveVolume();
    if (!this._muted && this._volume > 0) {
      this._audio.play().catch(() => {});
    }
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

  // Electrified crackle played when the marble is hit by a blitz strike.
  playBlitz() {
    if (this._muted || this._volume === 0) return;
    try {
      const ac  = this._getAudioCtx();
      const vol = (this._volume / 100) * 0.55;
      const len = Math.floor(ac.sampleRate * 0.45); // 450 ms

      const buf  = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t   = i / len;
        // Three overlapping crackle bursts for a "sustained electric shock" feel
        const env = Math.exp(-t * 5) + 0.4 * Math.exp(-(((t - 0.12) / 0.08) ** 2))
                                     + 0.25 * Math.exp(-(((t - 0.28) / 0.06) ** 2));
        data[i] = (Math.random() * 2 - 1) * env;
      }

      const src = ac.createBufferSource();
      src.buffer = buf;

      // High-pass to give it a crispy electric edge
      const hpf = ac.createBiquadFilter();
      hpf.type            = 'highpass';
      hpf.frequency.value = 1800;
      hpf.Q.value         = 1.5;

      // Bandpass sweep upward – "electrified" rising pitch
      const bpf = ac.createBiquadFilter();
      bpf.type            = 'bandpass';
      bpf.frequency.value = 3000;
      bpf.frequency.linearRampToValueAtTime(8000, ac.currentTime + 0.45);
      bpf.Q.value         = 0.6;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.45);

      src.connect(hpf);
      hpf.connect(bpf);
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
