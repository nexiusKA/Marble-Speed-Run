// ── ghost.js ─────────────────────────────────────────────────────────────────
// Ghost of your best endless run (Trackmania style).
//
// Every endless run is recorded: the level seed plus the marble position every
// GHOST_SAMPLE_MS of run time. When a run ends with a better result than the
// stored ghost it becomes the new ghost. With Ghost Mode on, the next run is
// generated from the ghost's seed – same track, obstacles and coins – and the
// ghost marble replays the recorded positions.
//
// Storage: localStorage 'mrGhost' (JSON, ~10 KB per minute of run time).

const GHOST_STORAGE_KEY  = 'mrGhost';
const GHOST_MODE_KEY     = 'mrGhostMode';
const GHOST_SAMPLE_MS    = 50;                  // 20 samples per second
const GHOST_MAX_SAMPLES  = 20 * 60 * 30;        // 30 minutes of run time
const GHOST_VERSION      = 1;

class GhostRecorder {
  constructor(seed) {
    this.seed  = seed >>> 0;
    this.xs    = [];
    this.ys    = [];
    this.rush  = [];   // sample indices where the Power Rush state toggles
    this._nextT = 0;
    this._inRush = false;
  }

  // Called every frame while running with the run time in ms.
  sample(elapsedMs, x, y, inRush) {
    while (elapsedMs >= this._nextT && this.xs.length < GHOST_MAX_SAMPLES) {
      if (!!inRush !== this._inRush) {
        this._inRush = !!inRush;
        this.rush.push(this.xs.length);
      }
      this.xs.push(Math.round(x * 2) / 2);
      this.ys.push(Math.round(y * 2) / 2);
      this._nextT += GHOST_SAMPLE_MS;
    }
  }

  get length() { return this.xs.length; }

  // Compact, storable form: x as half-pixels, y as delta half-pixels
  toData(result, extra) {
    const xs = this.xs.map((v) => Math.round(v * 2));
    const dy = [];
    let prev = 0;
    for (const v of this.ys) {
      const iv = Math.round(v * 2);
      dy.push(iv - prev);
      prev = iv;
    }
    return Object.assign({
      v: GHOST_VERSION,
      seed: this.seed,
      result,
      step: GHOST_SAMPLE_MS,
      xs,
      dy,
      rush: this.rush.slice(),
      date: new Date().toISOString().slice(0, 10),
    }, extra || {});
  }
}

class GhostReplay {
  constructor(data) {
    this.seed   = data.seed >>> 0;
    this.result = data.result;
    this.step   = data.step || GHOST_SAMPLE_MS;
    this.voidRate = data.voidRate;
    this.xs = data.xs.map((v) => v / 2);
    this.ys = [];
    let acc = 0;
    for (const d of data.dy) { acc += d; this.ys.push(acc / 2); }
    this._rushToggles = data.rush || [];
  }

  get length() { return this.xs.length; }
  get durationMs() { return (this.xs.length - 1) * this.step; }

  _inRushAt(index) {
    let inRush = false;
    for (const t of this._rushToggles) {
      if (t > index) break;
      inRush = !inRush;
    }
    return inRush;
  }

  // Interpolated position at run time t (ms); done = the ghost's run has ended
  positionAt(t) {
    const n = this.xs.length;
    if (n === 0) return null;
    const f = Math.max(0, t / this.step);
    const i = Math.floor(f);
    if (i >= n - 1) {
      return { x: this.xs[n - 1], y: this.ys[n - 1], rush: this._inRushAt(n - 1), done: true };
    }
    const a = f - i;
    return {
      x: this.xs[i] + (this.xs[i + 1] - this.xs[i]) * a,
      y: this.ys[i] + (this.ys[i + 1] - this.ys[i]) * a,
      rush: this._inRushAt(i),
      done: false,
    };
  }
}

const GhostStore = {
  load() {
    try {
      const raw = localStorage.getItem(GHOST_STORAGE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== GHOST_VERSION || typeof d.seed !== 'number' || !Array.isArray(d.xs) ||
          !Array.isArray(d.dy) || d.xs.length !== d.dy.length || d.xs.length < 2 ||
          !Number.isFinite(d.result)) {
        return null;
      }
      return new GhostReplay(d);
    } catch (_) {
      return null;
    }
  },

  save(data) {
    try {
      localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (_) {
      return false; // storage full / unavailable – keep playing without a ghost
    }
  },

  clear() {
    try { localStorage.removeItem(GHOST_STORAGE_KEY); } catch (_) { /* ignore */ }
  },

  loadMode() {
    try { return localStorage.getItem(GHOST_MODE_KEY) === '1'; } catch (_) { return false; }
  },

  saveMode(on) {
    try { localStorage.setItem(GHOST_MODE_KEY, on ? '1' : '0'); } catch (_) { /* ignore */ }
  },
};
