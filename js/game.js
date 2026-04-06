// ── Game ─────────────────────────────────────────────────────────────────────

const STATE = { MENU: 'menu', RUNNING: 'running', DEAD: 'dead' };

// World-units between successive content-generation passes
const GEN_SEGMENT = 500;

// Pickup spawn rate: one pickup per this many world-units on average
const PICKUP_RATE = 900;

// Pickup type weights [speed, dash, fog_slow, shield, ghost]
const PICKUP_WEIGHTS = [0.28, 0.22, 0.22, 0.10, 0.18];
const PICKUP_TYPES   = ['speed', 'dash', 'fog_slow', 'shield', 'ghost'];

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;

    this.input = new Input();
    this.ui    = new UI();

    // Persist best distance across sessions; validate to guard against tampered storage
    const stored = parseInt(localStorage.getItem('mrBestDist') || '0', 10);
    this.bestDistance = Number.isFinite(stored) && stored >= 0 ? stored : 0;

    // Debug mode: enable via ?debug in the URL or by pressing # in-game
    this.debugMode = (typeof location !== 'undefined') &&
                     new URLSearchParams(location.search).has('debug');
    this.fps = 0; // updated by the game loop in main.js

    // Sound settings – volume is persisted; muted state is session-only so a
    // stale "off" value from a previous session never silences the game on reload.
    this._soundOn  = true;
    const volRaw   = parseInt(localStorage.getItem('mrVolume') || '70', 10);
    this._volume   = Number.isFinite(volRaw) && volRaw >= 0 && volRaw <= 100 ? volRaw : 70;

    // Steering sensitivity (0–100, default 50). Persisted across sessions.
    const steerRaw        = parseInt(localStorage.getItem('mrSteerSens') || '50', 10);
    this._steerSensitivity = Number.isFinite(steerRaw) && steerRaw >= 0 && steerRaw <= 100 ? steerRaw : 50;

    this.state = STATE.MENU;
    this._init();

    this.ui.showStart(() => this.startRun());
    this.ui.updateBestDistance(this.bestDistance);

    // Wire up sound controls in the start overlay
    this._initSoundControls();

    // Wire up steering sensitivity controls in the start overlay
    this._initSteerControls();

    // Surface audio-load failures so they are visible in the console
    const bgMusicEl = document.getElementById('bg-music');
    if (bgMusicEl) {
      bgMusicEl.volume = this._volume / 100;
      bgMusicEl.addEventListener('error', () => {
        console.warn('[Audio] Failed to load background music:', bgMusicEl.error);
      });
    }
  }

  // ── Sound control wiring ──────────────────────────────────────────────────
  _initSoundControls() {
    const toggleBtn  = document.getElementById('sound-toggle');
    const volSlider  = document.getElementById('volume-slider');
    if (!toggleBtn || !volSlider) return;

    // Restore saved values
    volSlider.value = this._volume;
    this._updateSoundUI(toggleBtn, volSlider);

    toggleBtn.addEventListener('click', () => {
      this._soundOn = !this._soundOn;
      this._applyAudioSettings();
      this._updateSoundUI(toggleBtn, volSlider);
    });

    volSlider.addEventListener('input', () => {
      const prev = this._volume;
      this._volume = parseInt(volSlider.value, 10);
      // Only re-enable sound if slider was dragged up from zero (explicit "turn on" intent)
      if (prev === 0 && this._volume > 0) this._soundOn = true;
      localStorage.setItem('mrVolume', String(this._volume));
      this._applyAudioSettings();
      this._updateSoundUI(toggleBtn, volSlider);
    });
  }

  _updateSoundUI(toggleBtn, volSlider) {
    if (!toggleBtn || !volSlider) return;
    toggleBtn.textContent = this._soundOn && this._volume > 0 ? '🔊' : '🔇';
    toggleBtn.classList.toggle('muted', !this._soundOn || this._volume === 0);
    // Always reflect the actual volume value on the slider; muted state is shown via icon only
    volSlider.style.setProperty('--val', `${this._volume}%`);
  }

  _applyAudioSettings() {
    const bgMusic = document.getElementById('bg-music');
    if (!bgMusic) return;
    bgMusic.volume = (this._soundOn && this._volume > 0) ? this._volume / 100 : 0;
  }

  // ── Steering sensitivity control wiring ───────────────────────────────────
  _initSteerControls() {
    const slider     = document.getElementById('steer-slider');
    const valueEl    = document.getElementById('steer-value');
    const defaultBtn = document.getElementById('steer-default-btn');
    if (!slider || !valueEl || !defaultBtn) return;

    const STEER_DEFAULT = 50;

    const apply = (v) => {
      this._steerSensitivity = v;
      valueEl.textContent = v;
      slider.style.setProperty('--val', `${v}%`);
      localStorage.setItem('mrSteerSens', String(v));
    };

    // Restore saved value
    slider.value = this._steerSensitivity;
    apply(this._steerSensitivity);

    slider.addEventListener('input', () => {
      apply(parseInt(slider.value, 10));
    });

    defaultBtn.addEventListener('click', () => {
      slider.value = STEER_DEFAULT;
      apply(STEER_DEFAULT);
    });
  }

  // Maps the 0–100 sensitivity setting to a steer-force multiplier.
  // At 50 (default) the multiplier is exactly 1.0 (i.e. the built-in STEER_FORCE).
  // At 0 steering is fully disabled; at 100 it steers at 200 % of the default.
  _steerMult() {
    return this._steerSensitivity / 50;
  }

  _playMusic() {
    const bgMusic = document.getElementById('bg-music');
    if (!bgMusic || !this._soundOn || this._volume === 0) return;
    this._applyAudioSettings();
    if (bgMusic.paused) {
      bgMusic.play().catch(e => {
        console.warn('[Audio] play() failed:', e);
        // Retry on the next user gesture in case the browser blocked autoplay
        let retryPending = false;
        const retry = () => {
          document.removeEventListener('click',      retry);
          document.removeEventListener('keydown',    retry);
          document.removeEventListener('touchstart', retry);
          if (retryPending) return;
          retryPending = true;
          this._applyAudioSettings();
          bgMusic.play().catch(e2 => console.debug('[Audio] retry play() failed:', e2));
        };
        document.addEventListener('click',      retry, { once: true });
        document.addEventListener('keydown',    retry, { once: true });
        document.addEventListener('touchstart', retry, { once: true });
      });
    }
  }

  // ── Initialise / reset all run-specific state ─────────────────────────────
  _init() {
    this.track     = new Track();
    this.marble    = new Marble(this.track.startX, this.track.startY);
    this.fog       = new Fog(this.track.startY);
    this.obstacles = [];
    this.pickups   = [];
    this.particles = [];

    this.elapsed   = 0;   // milliseconds this run
    this.cameraY   = this.track.startY - CANVAS_H * 0.28;
    this.shakeX    = 0;
    this.shakeY    = 0;

    // Pickup effects
    this.speedBoostTimer = 0;
    this.shieldTimer     = 0;
    this.ghostTimer      = 0;
    this.pickupMsg       = null; // { text, timer }

    // Level-generation cursor (last world Y for which content was generated)
    this.levelGenY = this.track.startY;

    // Pre-populate the first stretch of content
    this._extendLevel(this.track.startY + 1800);
  }

  startRun() {
    this._init();
    this.state = STATE.RUNNING;
    this.ui.updateDistance(0);
    if (this.debugMode) console.log('[DEBUG] Run started');
    this._playMusic();
  }

  restart() {
    this.ui.hideGameOver();
    this.startRun();
  }

  // Distance in metres (1 world-unit = 1 m for display purposes)
  get distance() {
    return Math.max(0, Math.floor(this.marble.y - this.track.startY));
  }

  // ── Main update ───────────────────────────────────────────────────────────
  update(dt) {
    // Debug-mode toggle (works in any state)
    if (this.input.consumeDebugToggle()) {
      this.debugMode = !this.debugMode;
      console.log(`[DEBUG] Debug mode ${this.debugMode ? 'ON' : 'OFF'}`);
    }

    if (this.state !== STATE.RUNNING) return;

    if (this.input.consumeRestart()) { this.restart(); return; }

    this.elapsed += dt * 1000;
    const elapsedSec = this.elapsed / 1000;

    // ── Marble physics ──────────────────────────────────────────────────────
    this.marble.update(dt, this.input, this.track, this._steerMult());

    // Speed-boost pickup: extra downward push
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      this.marble.vy = Math.min(this.marble.vy + 180 * dt, MAX_SPEED_Y);
    }

    // ── Fog ─────────────────────────────────────────────────────────────────
    this.fog.update(dt, this.distance);

    if (this.fog.isCatching(this.marble)) {
      if (this.shieldTimer > 0) {
        // Consume the shield and push the fog back
        this.shieldTimer = 0;
        this.fog.y = this.marble.y - 480;
        this._showPickupMsg('SHIELD USED!');
      } else {
        this._gameOver();
        return;
      }
    }
    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    // ── Obstacles ───────────────────────────────────────────────────────────
    for (const obs of this.obstacles) {
      obs.update(dt);
      if (this.ghostTimer <= 0) obs.checkCollision(this.marble);
    }
    if (this.ghostTimer > 0) this.ghostTimer -= dt;

    // ── Pickups ─────────────────────────────────────────────────────────────
    for (const pu of this.pickups) {
      pu.update(dt);
      pu.checkCollision(this.marble, this);
    }

    // Pickup message fade
    if (this.pickupMsg) {
      this.pickupMsg.timer -= dt;
      if (this.pickupMsg.timer <= 0) this.pickupMsg = null;
    }

    // ── Particles ───────────────────────────────────────────────────────────
    if (this.marble.speed > 300 && Math.random() < dt * 12) {
      this._spawnParticle(this.marble.x, this.marble.y);
    }
    this._updateParticles(dt);

    // ── Camera ──────────────────────────────────────────────────────────────
    const targetCamY = this.marble.y - CANVAS_H * 0.28;
    this.cameraY     = lerp(this.cameraY, targetCamY, clamp(dt * 7, 0, 1));

    // Screen shake
    if (this.marble.shakeTimer > 0) {
      this.shakeX = (Math.random() - 0.5) * 8;
      this.shakeY = (Math.random() - 0.5) * 8;
    } else {
      this.shakeX = lerp(this.shakeX, 0, dt * 15);
      this.shakeY = lerp(this.shakeY, 0, dt * 15);
    }

    // ── Level extension & pruning ───────────────────────────────────────────
    this._extendLevel(this.marble.y + 2500);
    this._pruneEntities(this.marble.y - 1200);

    // ── HUD ─────────────────────────────────────────────────────────────────
    this.ui.updateDistance(this.distance);
  }

  // ── Level content management ──────────────────────────────────────────────
  _extendLevel(upToY) {
    this.track.extend(upToY);
    while (this.levelGenY < upToY) {
      const nextY = this.levelGenY + GEN_SEGMENT;
      this._generateContent(this.levelGenY, nextY);
      this.levelGenY = nextY;
    }
  }

  _generateContent(fromY, toY) {
    // Leave the very beginning clear so the player can get moving
    if (fromY < this.track.startY + 300) return;

    const difficulty = Math.min(fromY / 12000, 1);

    // Obstacles
    const newObs = buildObstaclesForRange(fromY, toY, difficulty, this.track);
    this.obstacles.push(...newObs);

    // Pickup (probabilistic – roughly one per PICKUP_RATE world-units)
    const segLen = toY - fromY;
    if (Math.random() < segLen / PICKUP_RATE) {
      const y = fromY + Math.random() * segLen;
      const { left, right } = this.track.getWallsAtY(y);
      const margin = 22;
      const x = left + margin + Math.random() * Math.max(0, right - left - margin * 2);
      const type = _weightedRandom(PICKUP_TYPES, PICKUP_WEIGHTS);
      this.pickups.push(new Pickup(x, y, type));
    }
  }

  _pruneEntities(behindY) {
    this.obstacles = this.obstacles.filter(o => o.worldY > behindY);
    this.pickups   = this.pickups.filter(p => !p.collected && p.worldY > behindY);
    this.track.prune(behindY - 400);
  }

  // ── Pickup effects ────────────────────────────────────────────────────────
  applyPickup(type) {
    switch (type) {
      case 'speed':
        this.speedBoostTimer = 4;
        break;
      case 'dash':
        this.marble.vy = Math.min(this.marble.vy + 500, MAX_SPEED_Y);
        break;
      case 'fog_slow':
        this.fog.slowDown(6);
        break;
      case 'shield':
        this.shieldTimer = 8;
        break;
      case 'ghost':
        this.ghostTimer = 5;
        break;
    }
    this._showPickupMsg(PICKUP_CONFIG[type].name);
    if (this.debugMode) console.log(`[DEBUG] Pickup collected: ${type}`);
    // Burst of particles on collection
    for (let i = 0; i < 14; i++) this._spawnParticle(this.marble.x, this.marble.y);
  }

  _showPickupMsg(text) {
    this.pickupMsg = { text, timer: 2.2 };
  }

  // ── Game over ─────────────────────────────────────────────────────────────
  _gameOver() {
    this.state = STATE.DEAD;
    const dist  = this.distance;
    const isNew = dist > this.bestDistance;
    if (isNew) {
      this.bestDistance = dist;
      localStorage.setItem('mrBestDist', String(dist));
    }
    if (this.debugMode) {
      console.log(`[DEBUG] Game over | dist=${dist}m | best=${this.bestDistance}m | newBest=${isNew}`);
    }
    this.ui.updateBestDistance(this.bestDistance);
    this.ui.showGameOver(dist, this.bestDistance, isNew, () => this.restart());
  }

  // ── Render ────────────────────────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    // Background (synthwave)
    this._renderSynthwaveBg(ctx);

    // Stars
    this._renderStars(ctx);

    // Track
    this.track.render(ctx, this.cameraY);

    // Obstacles
    for (const obs of this.obstacles) obs.render(ctx, this.cameraY);

    // Pickups
    for (const pu of this.pickups) pu.render(ctx, this.cameraY);

    // Particles (screen space)
    for (const p of this.particles) {
      const sy = p.y - this.cameraY;
      ctx.beginPath();
      ctx.arc(p.x, sy, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,200,255,${p.life * 0.8})`;
      ctx.fill();
    }

    // Fog (rendered before marble so marble is always on top)
    this.fog.render(ctx, this.cameraY);

    // Marble (world space – translate by -cameraY)
    ctx.save();
    ctx.translate(0, -this.cameraY);
    this._renderMarble(ctx);
    ctx.restore();

    // ── Screen-space overlays ───────────────────────────────────────────────

    // Danger vignette when fog is close
    if (this.state === STATE.RUNNING) {
      const danger = this.fog.dangerRatio(this.marble);
      if (danger > 0.25) {
        const intensity = (danger - 0.25) / 0.75;
        const vig = ctx.createRadialGradient(
          CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.18,
          CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.75
        );
        vig.addColorStop(0, 'rgba(180,0,80,0)');
        vig.addColorStop(1, `rgba(180,0,80,${intensity * 0.4})`);
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
    }

    // Shield ring around marble
    if (this.shieldTimer > 0) {
      const msy = this.marble.y - this.cameraY;
      ctx.beginPath();
      ctx.arc(this.marble.x, msy, this.marble.radius * 2.2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(80,200,255,${0.45 + 0.45 * Math.sin(Date.now() / 200)})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    // Speed-boost aura around marble
    if (this.speedBoostTimer > 0) {
      const msy = this.marble.y - this.cameraY;
      ctx.beginPath();
      ctx.arc(this.marble.x, msy, this.marble.radius * 1.9, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,200,0,${0.4 + 0.35 * Math.sin(Date.now() / 140)})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // Ghost aura – pulsing purple ring; obstacles are passable while active
    if (this.ghostTimer > 0) {
      const msy = this.marble.y - this.cameraY;
      const pulse = 0.45 + 0.45 * Math.sin(Date.now() / 120);
      ctx.beginPath();
      ctx.arc(this.marble.x, msy, this.marble.radius * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200,100,255,${pulse})`;
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.marble.x, msy, this.marble.radius * 1.7, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(230,160,255,${pulse * 0.6})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    // Pickup message
    if (this.pickupMsg && this.pickupMsg.timer > 0) {
      const alpha = Math.min(this.pickupMsg.timer, 1);
      ctx.save();
      ctx.font          = 'bold 22px monospace';
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'middle';
      ctx.fillStyle     = `rgba(255,240,80,${alpha})`;
      ctx.fillText(this.pickupMsg.text, CANVAS_W / 2, CANVAS_H * 0.33);
      ctx.restore();
    }

    // Debug overlay (rendered last so it sits on top of everything)
    if (this.debugMode) this._renderDebug(ctx);

    ctx.restore();
  }

  // ── Marble rendering (called inside world-space translation) ──────────────
  _renderMarble(ctx) {
    const trail = this.marble.trail;
    for (let i = 0; i < trail.length; i++) {
      const alpha = (i / trail.length) * 0.35;
      const r     = this.marble.radius * (i / trail.length) * 0.7;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, Math.max(r, 1), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120, 180, 255, ${alpha})`;
      ctx.fill();
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(
      this.marble.x, this.marble.y + this.marble.radius * 0.6,
      this.marble.radius * 0.9, this.marble.radius * 0.3, 0, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Marble gradient
    const grad = ctx.createRadialGradient(
      this.marble.x - this.marble.radius * 0.3,
      this.marble.y - this.marble.radius * 0.35,
      this.marble.radius * 0.1,
      this.marble.x, this.marble.y, this.marble.radius
    );
    grad.addColorStop(0,    '#cce8ff');
    grad.addColorStop(0.45, '#4488ee');
    grad.addColorStop(1,    '#112266');
    ctx.beginPath();
    ctx.arc(this.marble.x, this.marble.y, this.marble.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(
      this.marble.x - this.marble.radius * 0.28,
      this.marble.y - this.marble.radius * 0.3,
      this.marble.radius * 0.28, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    // Speed glow
    const speed = this.marble.speed;
    if (speed > 250) {
      const intensity = clamp((speed - 250) / 400, 0, 1);
      ctx.beginPath();
      ctx.arc(this.marble.x, this.marble.y, this.marble.radius * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80,160,255,${intensity * 0.25})`;
      ctx.fill();
    }
  }

  // ── Debug overlay ─────────────────────────────────────────────────────────
  _renderDebug(ctx) {
    ctx.save();

    // ── Info panel ──────────────────────────────────────────────────────────
    const gap = this.marble
      ? (this.marble.y - (this.marble.radius || 0) - this.fog.y).toFixed(1)
      : 'n/a';

    const lines = [
      { text: '[ DEBUG ]  # to toggle', color: '#00ff88' },
      { text: `FPS: ${this.fps}`, color: '#ffff00' },
      { text: `State: ${this.state}`, color: '#00ffff' },
      { text: `Elapsed: ${(this.elapsed / 1000).toFixed(1)} s`, color: '#aaaacc' },
      { text: '' },
      { text: 'MARBLE', color: '#88aaff' },
      { text: `  x=${this.marble.x.toFixed(1)}  y=${this.marble.y.toFixed(1)}`, color: '#aabbdd' },
      { text: `  vx=${this.marble.vx.toFixed(1)}  vy=${this.marble.vy.toFixed(1)}`, color: '#aabbdd' },
      { text: `  speed=${this.marble.speed.toFixed(1)}`, color: '#aabbdd' },
      { text: '' },
      { text: 'FOG', color: '#dd88ff' },
      { text: `  y=${this.fog.y.toFixed(1)}  spd=${this.fog.speed.toFixed(1)}`, color: '#ccaaee' },
      { text: `  gap=${gap}  slow=${this.fog.slowTimer.toFixed(2)} s`, color: '#ccaaee' },
      { text: '' },
      { text: `Camera Y: ${this.cameraY.toFixed(1)}`, color: '#ffaa44' },
      { text: `Distance: ${this.distance} m`, color: '#ffaa44' },
      { text: '' },
      { text: `Obstacles: ${this.obstacles.length}`, color: '#88ff88' },
      { text: `Pickups:   ${this.pickups.length}`, color: '#88ff88' },
      { text: `Particles: ${this.particles.length}`, color: '#88ff88' },
      { text: `Knots:     ${this.track.knots.length}`, color: '#88ff88' },
      { text: '' },
      { text: `SpeedBoost: ${this.speedBoostTimer.toFixed(2)} s`, color: '#ffdd00' },
      { text: `Shield:     ${this.shieldTimer.toFixed(2)} s`, color: '#ffdd00' },
      { text: `Ghost:      ${this.ghostTimer.toFixed(2)} s`, color: '#ffdd00' },
    ];

    const lineH  = 14;
    const padX   = 6;
    const padY   = 6;
    const panelW = 192;
    const panelH = lines.length * lineH + padY * 2;
    const px     = 6;
    const py     = 36; // below HUD

    // Panel background
    ctx.globalAlpha = 0.84;
    ctx.fillStyle   = '#00080f';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth   = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);

    ctx.font         = '11px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      const { text, color } = lines[i];
      if (!text) continue;
      ctx.fillStyle = color || '#cccccc';
      ctx.fillText(text, px + padX, py + padY + i * lineH);
    }

    // ── Hitboxes ────────────────────────────────────────────────────────────
    ctx.lineWidth = 1.5;

    // Marble collision circle
    const msy = this.marble.y - this.cameraY;
    ctx.beginPath();
    ctx.arc(this.marble.x, msy, this.marble.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff00';
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fog leading-edge line
    const fogSY = this.fog.y - this.cameraY;
    if (fogSY > -4 && fogSY < CANVAS_H + 4) {
      ctx.beginPath();
      ctx.moveTo(0, fogSY);
      ctx.lineTo(CANVAS_W, fogSY);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth   = 2;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font      = '10px monospace';
      ctx.fillStyle = '#ff00ff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('FOG', CANVAS_W - 4, fogSY - 2);
    }

    // Obstacle hitboxes
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    for (const obs of this.obstacles) {
      if (obs instanceof RotatingBar) {
        const { ax, ay, bx, by } = obs.endpoints();
        ctx.beginPath();
        ctx.moveTo(ax, ay - this.cameraY);
        ctx.lineTo(bx, by - this.cameraY);
        ctx.strokeStyle = '#ff4400';
        ctx.stroke();
      } else if (obs instanceof MovingBlocker) {
        const rx = obs.x - obs.w / 2;
        const ry = obs.worldY - obs.h / 2 - this.cameraY;
        if (ry > -obs.h && ry < CANVAS_H) {
          ctx.beginPath();
          ctx.rect(rx, ry, obs.w, obs.h);
          ctx.strokeStyle = '#ff8800';
          ctx.stroke();
        }
      } else if (obs instanceof BoostPad) {
        const rx = obs.cx - obs.w / 2;
        const ry = obs.worldY - obs.h / 2 - this.cameraY;
        if (ry > -obs.h && ry < CANVAS_H) {
          ctx.beginPath();
          ctx.rect(rx, ry, obs.w, obs.h);
          ctx.strokeStyle = '#00ff88';
          ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);

    // Pickup collection radii
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const pu of this.pickups) {
      if (pu.collected) continue;
      const psy = pu.worldY - this.cameraY;
      if (psy < -60 || psy > CANVAS_H + 60) continue;
      ctx.beginPath();
      ctx.arc(pu.x, psy, pu.radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffff00';
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.restore();
  }

  // ── Synthwave background ──────────────────────────────────────────────────────
  _renderSynthwaveBg(ctx) {
    // Deep space → violet → magenta gradient sky
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0,    '#06001a');
    sky.addColorStop(0.42, '#110038');
    sky.addColorStop(0.70, '#260050');
    sky.addColorStop(0.88, '#440058');
    sky.addColorStop(1,    '#2e0040');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Retro sun – centre just below the canvas; top arc peeks up ──────────
    const sunCX = CANVAS_W / 2;
    const sunCY = CANVAS_H + 18;
    const sunR  = 158;

    // Outer atmospheric halo
    const halo = ctx.createRadialGradient(sunCX, sunCY, sunR * 0.45, sunCX, sunCY, sunR * 1.7);
    halo.addColorStop(0,   'rgba(255, 80,200,0.30)');
    halo.addColorStop(0.45,'rgba(200,  0,160,0.14)');
    halo.addColorStop(1,   'rgba( 80,  0,100,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sunCX, sunCY, sunR * 1.7, 0, Math.PI * 2);
    ctx.fill();

    // Sun disc (classic yellow → orange → hot-pink → purple)
    const sunFill = ctx.createLinearGradient(sunCX, sunCY - sunR, sunCX, sunCY + sunR);
    sunFill.addColorStop(0,    '#ffee55');
    sunFill.addColorStop(0.22, '#ff9900');
    sunFill.addColorStop(0.52, '#ff2288');
    sunFill.addColorStop(1,    '#aa00ee');
    ctx.beginPath();
    ctx.arc(sunCX, sunCY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunFill;
    ctx.fill();

    // Horizontal stripe bands – denser near the horizon (classic retrowave)
    const bandTop = sunCY - sunR;
    for (let b = 0; b < 16; b++) {
      const frac  = b / 16;
      const bY    = bandTop + frac * sunR * 2;
      const bH    = Math.max(1.5, sunR * 0.05 * (0.4 + frac * 2.2));
      ctx.fillStyle = '#06001a';
      ctx.fillRect(sunCX - sunR, bY + bH * 0.6, sunR * 2, bH);
    }

    // ── Neon scan-lines (lower half, scroll with camera for motion feel) ────
    const gridTop  = CANVAS_H * 0.60;
    const scroll   = (this.cameraY % 52) / 52;
    const nLines   = 14;
    for (let i = 0; i < nLines; i++) {
      const t     = (i + scroll) / nLines;
      const ly    = gridTop + t * (CANVAS_H - gridTop);
      const alpha = 0.04 + (1 - t) * 0.22;
      ctx.beginPath();
      ctx.moveTo(0,        ly);
      ctx.lineTo(CANVAS_W, ly);
      ctx.strokeStyle = `rgba(255,0,200,${alpha.toFixed(3)})`;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    }
  }

  // ── Background stars / pinball light dots (seeded per camera bucket) ─────────
  _renderStars(ctx) {
    const bucket = Math.floor(this.cameraY / CANVAS_H);
    const seed   = bucket * 1234567;

    // Pinball neon light colors
    const colors = [
      [255, 0,   255],  // magenta
      [0,   229, 255],  // cyan
      [255, 230, 0  ],  // yellow
      [0,   255, 120],  // green
      [255, 100, 0  ],  // orange
      [180, 100, 255],  // purple
    ];

    for (let i = 0; i < 38; i++) {
      const sx   = pseudoRand(seed + i * 7)     * CANVAS_W;
      const sy   = pseudoRand(seed + i * 7 + 1) * CANVAS_H;
      const r    = pseudoRand(seed + i * 7 + 2) * 1.4 + 0.4;
      const a    = pseudoRand(seed + i * 7 + 3) * 0.55 + 0.1;
      const ci   = Math.floor(pseudoRand(seed + i * 7 + 4) * colors.length);
      const [cr, cg, cb] = colors[ci];

      // Glow halo
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * 0.18})`;
      ctx.fill();

      // Bright core
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.fill();
    }
  }

  _spawnParticle(x, y) {
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.6) * 60,
      life: 1,
      size: 2 + Math.random() * 3,
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.life -= dt * 2.5;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Simple deterministic pseudo-random (0..1) from a seed – used for stars
function pseudoRand(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Pick a random item according to a weight array
function _weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
