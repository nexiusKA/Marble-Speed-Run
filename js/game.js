// ── Game ─────────────────────────────────────────────────────────────────────

const STATE = { MENU: 'menu', RUNNING: 'running', DEAD: 'dead' };

// World-units between successive content-generation passes
const GEN_SEGMENT = 500;

// Pickup spawn rate: one pickup per this many world-units on average
const PICKUP_RATE = 900;

// Pickup type weights [speed, dash, fog_slow, shield, ghost]
const PICKUP_WEIGHTS = [0.28, 0.22, 0.22, 0.10, 0.18];
const PICKUP_TYPES   = ['speed', 'dash', 'fog_slow', 'shield', 'ghost'];
const POWER_RUSH_CORRIDOR_LEFT  = 100;   // fixed left wall X during rush
const POWER_RUSH_CORRIDOR_RIGHT = 380;   // fixed right wall X during rush
const POWER_RUSH_DURATION       = 20;    // seconds the rush phase lasts
const POWER_RUSH_DOOR_SPACING   = 600;   // world-units between successive door gates
const POWER_RUSH_PUSH_PER_DOOR  = 220;   // extra world-units of fog pushback per door scored
const POWER_RUSH_INTERVAL       = 10000; // metres between power-rush pickup spawns
const NORMAL_DOOR_INTERVAL      = 5000;  // min world-units between normal-mode door gates

// ── PowerRushTrack ────────────────────────────────────────────────────────────
// A simple fixed-width straight corridor used during Power Rush mode.
// Provides the same interface as Track so marble.update() can use it directly.
class PowerRushTrack {
  getWallsAtY(_y) {
    return { left: POWER_RUSH_CORRIDOR_LEFT, right: POWER_RUSH_CORRIDOR_RIGHT };
  }

  resolveCollision(marble) {
    const innerLeft  = POWER_RUSH_CORRIDOR_LEFT  + marble.radius;
    const innerRight = POWER_RUSH_CORRIDOR_RIGHT - marble.radius;
    if (marble.x < innerLeft) {
      marble.x  = innerLeft;
      marble.vx = Math.abs(marble.vx) * BOUNCE_FACTOR;
      marble.triggerShake();
    } else if (marble.x > innerRight) {
      marble.x  = innerRight;
      marble.vx = -Math.abs(marble.vx) * BOUNCE_FACTOR;
      marble.triggerShake();
    }
  }

  extend() {}
  prune()  {}
  isOutOfBounds() { return false; }
  hasFinished()   { return false; }

  render(ctx, cameraY) {
    // Dark areas flanking the corridor
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, POWER_RUSH_CORRIDOR_LEFT, CANVAS_H);
    ctx.fillRect(POWER_RUSH_CORRIDOR_RIGHT, 0, CANVAS_W - POWER_RUSH_CORRIDOR_RIGHT, CANVAS_H);

    // Corridor floor
    const grad = ctx.createLinearGradient(POWER_RUSH_CORRIDOR_LEFT, 0, POWER_RUSH_CORRIDOR_RIGHT, 0);
    grad.addColorStop(0,   '#0c0800');
    grad.addColorStop(0.5, '#1a1000');
    grad.addColorStop(1,   '#0c0800');
    ctx.fillStyle = grad;
    ctx.fillRect(POWER_RUSH_CORRIDOR_LEFT, 0,
                 POWER_RUSH_CORRIDOR_RIGHT - POWER_RUSH_CORRIDOR_LEFT, CANVAS_H);

    // Subtle diagonal grid inside corridor
    ctx.save();
    ctx.beginPath();
    ctx.rect(POWER_RUSH_CORRIDOR_LEFT, 0,
             POWER_RUSH_CORRIDOR_RIGHT - POWER_RUSH_CORRIDOR_LEFT, CANVAS_H);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,160,0,0.10)';
    ctx.lineWidth   = 0.8;
    const gridSpacing = 36;
    const gridOff     = (cameraY % gridSpacing);
    for (let wy = -gridSpacing; wy <= CANVAS_H + gridSpacing; wy += gridSpacing) {
      const sy = wy + gridOff;
      ctx.beginPath();
      ctx.moveTo(POWER_RUSH_CORRIDOR_LEFT,  sy);
      ctx.lineTo(POWER_RUSH_CORRIDOR_RIGHT, sy - 80);
      ctx.stroke();
    }
    ctx.restore();

    // Gold neon walls
    ctx.save();
    ctx.shadowBlur  = 22;
    ctx.shadowColor = '#ffcc00';
    ctx.lineWidth   = 3;
    ctx.strokeStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(POWER_RUSH_CORRIDOR_LEFT, 0);
    ctx.lineTo(POWER_RUSH_CORRIDOR_LEFT, CANVAS_H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(POWER_RUSH_CORRIDOR_RIGHT, 0);
    ctx.lineTo(POWER_RUSH_CORRIDOR_RIGHT, CANVAS_H);
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();
  }
}

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

    // Sound – volume is persisted; muted state resets each session.
    const volRaw = parseInt(localStorage.getItem('mrVolume') || '70', 10);
    const vol    = Number.isFinite(volRaw) && volRaw >= 0 && volRaw <= 100 ? volRaw : 70;
    this.sound   = new SoundManager(vol, false);

    // Steering sensitivity (1–100, default 100). Persisted across sessions.
    const steerRaw        = parseInt(localStorage.getItem('mrSteerSens') || '100', 10);
    this._steerSensitivity = Number.isFinite(steerRaw) && steerRaw >= 1 && steerRaw <= 100 ? steerRaw : 100;

    // Fall speed (1–100, default 100). Persisted across sessions.
    const fallRaw         = parseInt(localStorage.getItem('mrFallSpeed') || '100', 10);
    this._fallSpeedSetting = Number.isFinite(fallRaw) && fallRaw >= 1 && fallRaw <= 100 ? fallRaw : 100;

    // Void speed (10–200, default 100). Persisted across sessions.
    const voidRateRaw      = parseInt(localStorage.getItem('mrVoidRate') || '100', 10);
    this._voidRateSetting  = Number.isFinite(voidRateRaw) && voidRateRaw >= 10 && voidRateRaw <= 200 ? voidRateRaw : 100;

    this.state = STATE.MENU;
    this._init();

    this.ui.showStart(() => this.startRun());
    this.ui.updateBestDistance(this.bestDistance);

    // Wire up sound controls in the start overlay
    this._initSoundControls();

    // Wire up steering sensitivity controls in the start overlay
    this._initSteerControls();

    // Wire up fall speed controls in the start overlay
    this._initFallSpeedControls();

    // Wire up void speed controls in the start overlay
    this._initVoidRateControls();
  }

  // ── Sound control wiring ──────────────────────────────────────────────────
  _initSoundControls() {
    const toggleBtn = document.getElementById('sound-toggle');
    const volSlider = document.getElementById('volume-slider');
    if (!toggleBtn || !volSlider) return;

    volSlider.value = this.sound.volume;
    this._updateSoundUI(toggleBtn, volSlider);

    toggleBtn.addEventListener('click', () => {
      this.sound.setMuted(!this.sound.muted);
      this._updateSoundUI(toggleBtn, volSlider);
    });

    volSlider.addEventListener('input', () => {
      const v = parseInt(volSlider.value, 10);
      this.sound.setVolume(v);
      localStorage.setItem('mrVolume', String(v));
      this._updateSoundUI(toggleBtn, volSlider);
    });
  }

  _updateSoundUI(toggleBtn, volSlider) {
    if (!toggleBtn || !volSlider) return;
    const active = !this.sound.muted && this.sound.volume > 0;
    toggleBtn.textContent = active ? '🔊' : '🔇';
    toggleBtn.classList.toggle('muted', !active);
    volSlider.style.setProperty('--val', `${this.sound.volume}%`);
  }

  // ── Steering sensitivity control wiring ───────────────────────────────────
  _initSteerControls() {
    const slider     = document.getElementById('steer-slider');
    const valueEl    = document.getElementById('steer-value');
    const defaultBtn = document.getElementById('steer-default-btn');
    if (!slider || !valueEl || !defaultBtn) return;

    const STEER_DEFAULT = 100;

    const apply = (v) => {
      v = Math.max(1, v);
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

  // Maps the 1–100 sensitivity setting to a steer-force multiplier.
  // At 25 the multiplier is 1.0 (original default feel).
  // At 1 steering is nearly disabled; at 100 it steers at 4× the default.
  _steerMult() {
    return this._steerSensitivity / 25;
  }

  // ── Fall speed control wiring ─────────────────────────────────────────────
  _initFallSpeedControls() {
    const slider     = document.getElementById('fall-slider');
    const valueEl    = document.getElementById('fall-value');
    const defaultBtn = document.getElementById('fall-default-btn');
    if (!slider || !valueEl || !defaultBtn) return;

    const FALL_DEFAULT = 100;

    const apply = (v) => {
      v = Math.max(1, v);
      this._fallSpeedSetting = v;
      valueEl.textContent = v;
      slider.style.setProperty('--val', `${v}%`);
      localStorage.setItem('mrFallSpeed', String(v));
    };

    // Restore saved value
    slider.value = this._fallSpeedSetting;
    apply(this._fallSpeedSetting);

    slider.addEventListener('input', () => {
      apply(parseInt(slider.value, 10));
    });

    defaultBtn.addEventListener('click', () => {
      slider.value = FALL_DEFAULT;
      apply(FALL_DEFAULT);
    });
  }

  // Maps the 1–100 fall-speed setting to a gravity multiplier.
  // At 100 (default) gravity is full; at 1 the marble falls very slowly.
  _fallMult() {
    return this._fallSpeedSetting / 100;
  }

  // ── Void speed control wiring ─────────────────────────────────────────────
  _initVoidRateControls() {
    const slider     = document.getElementById('void-rate-slider');
    const valueEl    = document.getElementById('void-rate-value');
    const defaultBtn = document.getElementById('void-rate-default-btn');
    if (!slider || !valueEl || !defaultBtn) return;

    const VOID_RATE_DEFAULT = 100;

    const apply = (v) => {
      v = Math.max(10, Math.min(200, v));
      this._voidRateSetting = v;
      valueEl.textContent = v;
      slider.style.setProperty('--val', `${(v - 10) / 190 * 100}%`);
      localStorage.setItem('mrVoidRate', String(v));
    };

    // Restore saved value
    slider.value = this._voidRateSetting;
    apply(this._voidRateSetting);

    slider.addEventListener('input', () => {
      apply(parseInt(slider.value, 10));
    });

    defaultBtn.addEventListener('click', () => {
      slider.value = VOID_RATE_DEFAULT;
      apply(VOID_RATE_DEFAULT);
    });
  }

  // Maps the 10–200 void-rate setting to a speed multiplier.
  // At 100 (default) the void moves at normal speed.
  _voidRateMult() {
    return this._voidRateSetting / 100;
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
    this.levelGenY       = this.track.startY;
    this.lastNormalDoorY = this.track.startY - NORMAL_DOOR_INTERVAL; // allow a door immediately at run start

    // ── Power Rush state ───────────────────────────────────────────────────
    this.powerRushActive    = false;
    this.powerRushTimer     = 0;   // seconds remaining in the rush phase
    this.powerRushCountdown = 0;   // 3-2-1 value shown after rush ends
    this.powerRushCdTimer   = 0;   // sub-timer for each countdown beat
    this.powerRushDoors     = 0;   // doors scored during the current rush
    this.powerRushFogBonus  = 0;   // accumulated fog pushback (combo-weighted)
    this.doorCombo          = 0;   // consecutive clean green-door passes (resets on red hit)
    this.powerRushTrack     = new PowerRushTrack();
    this.powerRushObstacles = [];
    this.powerRushGenY      = 0;   // generation cursor for rush door gates
    this.nextPowerRushDist  = POWER_RUSH_INTERVAL; // distance at which next pickup spawns

    // Rush-line electric animation state
    this._rushLineFlickerTimer = 0;
    this._rushLineBolts        = [];
    this._rushLineWorldY       = this.track.startY + POWER_RUSH_INTERVAL; // cached trigger Y

    // Pre-populate the first stretch of content
    this._extendLevel(this.track.startY + 1800);
  }

  startRun() {
    this._init();
    this.state = STATE.RUNNING;
    this.ui.updateDistance(0);
    this.ui.updateVoidDistance('--');
    if (this.debugMode) console.log('[DEBUG] Run started');
    this.sound.start();
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

    // ── Power Rush Mode – runs its own update branch ────────────────────────
    // Auto-trigger every POWER_RUSH_INTERVAL metres instead of via a pickup
    if (!this.powerRushActive && this.distance > 0 && this.distance >= this.nextPowerRushDist) {
      this.nextPowerRushDist += POWER_RUSH_INTERVAL;
      this._rushLineWorldY    = this.track.startY + this.nextPowerRushDist;
      this._enterPowerRush();
      return;
    }

    if (this.powerRushActive) {
      this._updatePowerRush(dt);
      return;
    }

    // ── Marble physics ──────────────────────────────────────────────────────
    this.marble.update(dt, this.input, this.track, this._steerMult(), this._fallMult());

    // Speed-boost pickup: extra downward push
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      this.marble.vy = Math.min(this.marble.vy + 180 * dt, MAX_SPEED_Y * this._fallMult());
    }

    // ── Fog ─────────────────────────────────────────────────────────────────
    this.fog.update(dt, this.distance, this._voidRateMult());

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
    this.ui.updateVoidDistance(Math.max(0, Math.floor(this.marble.y - this.marble.radius - this.fog.y)));

    // ── Rush-line bolt flicker (refresh every ~80 ms) ────────────────────────
    this._rushLineFlickerTimer -= dt;
    if (this._rushLineFlickerTimer <= 0) {
      this._rushLineFlickerTimer = 0.08;
      this._rebuildRushLineBolts();
    }
  }

  // ── Power Rush update (replaces the main update while rush is active) ─────
  _updatePowerRush(dt) {
    // Marble physics – use the fixed-width power rush corridor
    this.marble.update(dt, this.input, this.powerRushTrack, this._steerMult(), this._fallMult());

    // Speed boost still applies inside rush
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      this.marble.vy = Math.min(this.marble.vy + 180 * dt, MAX_SPEED_Y * this._fallMult());
    }

    // Update door obstacles and check marble collisions
    for (const obs of this.powerRushObstacles) {
      obs.update(dt);
      obs.checkCollision(this.marble);
    }

    // Score: award a point for each door gate the marble fully passes through
    for (const obs of this.powerRushObstacles) {
      if (!obs.scoreGiven && this.marble.y > obs.worldY + obs.h / 2) {
        obs.scoreGiven = true;
        this.powerRushDoors++;
        this.sound.playZap();
        if (!obs.hitRed) {
          this.doorCombo++;
          const multiplier = this.doorCombo;
          this.powerRushFogBonus += POWER_RUSH_PUSH_PER_DOOR * multiplier;
          if (this.doorCombo >= 2) {
            this._showPickupMsg(`COMBO x${this.doorCombo}! 🎯`);
          }
        } else {
          this.doorCombo = 0;
          this.powerRushFogBonus += POWER_RUSH_PUSH_PER_DOOR;
        }
      }
    }

    // Particles
    if (this.marble.speed > 300 && Math.random() < dt * 12) {
      this._spawnParticle(this.marble.x, this.marble.y);
    }
    this._updateParticles(dt);

    // Pickup message fade
    if (this.pickupMsg) {
      this.pickupMsg.timer -= dt;
      if (this.pickupMsg.timer <= 0) this.pickupMsg = null;
    }

    // Camera
    const targetCamY = this.marble.y - CANVAS_H * 0.28;
    this.cameraY = lerp(this.cameraY, targetCamY, clamp(dt * 7, 0, 1));

    // Screen shake
    if (this.marble.shakeTimer > 0) {
      this.shakeX = (Math.random() - 0.5) * 8;
      this.shakeY = (Math.random() - 0.5) * 8;
    } else {
      this.shakeX = lerp(this.shakeX, 0, dt * 15);
      this.shakeY = lerp(this.shakeY, 0, dt * 15);
    }

    // Extend / prune power rush door gates
    this._extendPowerRush(this.marble.y + 1800);
    this._prunePowerRushObstacles(this.marble.y - 1200);

    // ── Rush timer / countdown ─────────────────────────────────────────────
    if (this.powerRushTimer > 0) {
      this.powerRushTimer -= dt;
      if (this.powerRushTimer <= 0) {
        this.powerRushTimer     = 0;
        this.powerRushCountdown = 3;
        this.powerRushCdTimer   = 1; // 1 second per beat
      }
    } else if (this.powerRushCountdown > 0) {
      this.powerRushCdTimer -= dt;
      if (this.powerRushCdTimer <= 0) {
        this.powerRushCountdown--;
        if (this.powerRushCountdown > 0) {
          this.powerRushCdTimer = 1;
        } else {
          this._exitPowerRush();
        }
      }
    }

    // HUD – distance is still measured normally (marble.y keeps advancing)
    this.ui.updateDistance(this.distance);
    this.ui.updateVoidDistance(Math.max(0, Math.floor(this.marble.y - this.marble.radius - this.fog.y)));
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
    const allowDoor = (fromY - this.lastNormalDoorY) >= NORMAL_DOOR_INTERVAL;
    const newObs = buildObstaclesForRange(fromY, toY, difficulty, this.track, allowDoor);
    const spawnedDoor = allowDoor && newObs.find(o => o instanceof DoorGate);
    if (spawnedDoor) {
      this.lastNormalDoorY = spawnedDoor.worldY;
    }
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

  // ── Power Rush helpers ────────────────────────────────────────────────────

  // Generate DoorGate obstacles for the power rush corridor up to upToY
  _extendPowerRush(upToY) {
    const left  = POWER_RUSH_CORRIDOR_LEFT;
    const right = POWER_RUSH_CORRIDOR_RIGHT;
    while (this.powerRushGenY < upToY) {
      this.powerRushObstacles.push(new DoorGate(this.powerRushGenY, left, right));
      this.powerRushGenY += POWER_RUSH_DOOR_SPACING;
    }
  }

  _prunePowerRushObstacles(behindY) {
    this.powerRushObstacles = this.powerRushObstacles.filter(o => o.worldY > behindY);
  }

  _enterPowerRush() {
    this.powerRushActive    = true;
    this.powerRushTimer     = POWER_RUSH_DURATION;
    this.powerRushCountdown = 0;
    this.powerRushCdTimer   = 0;
    this.powerRushDoors     = 0;
    this.powerRushFogBonus  = 0;
    this.doorCombo          = 0;

    // Clear normal obstacles/pickups so they don't interfere on return
    this.obstacles = [];
    this.pickups   = [];

    // Start generating door gates 200 units ahead of the marble
    this.powerRushObstacles = [];
    this.powerRushGenY      = this.marble.y + 200;

    this._showPickupMsg('⚡ POWER RUSH ⚡');
    this.sound.playPowerRushStart();

    if (this.debugMode) console.log('[DEBUG] Power Rush entered');
  }

  _exitPowerRush() {
    const doorsScored = this.powerRushDoors;
    const fogPushback = this.powerRushFogBonus;

    this.powerRushActive    = false;
    this.powerRushObstacles = [];

    // Reset the next rush trigger to POWER_RUSH_INTERVAL metres from the EXIT
    // point so that distance traveled during rush doesn't shorten the gap.
    this.nextPowerRushDist = this.distance + POWER_RUSH_INTERVAL;
    this._rushLineWorldY   = this.track.startY + this.nextPowerRushDist;

    // Clear any stale normal obstacles/pickups from before the rush started
    this.obstacles = [];
    this.pickups   = [];

    // Push the fog back proportional to doors scored (reward for good performance)
    this.fog.y -= fogPushback;

    // Resume normal level generation from the current marble position
    this.levelGenY = this.marble.y;
    this._extendLevel(this.marble.y + 2500);

    // Show result
    if (doorsScored > 0) {
      this._showPickupMsg(`RUSH BONUS: ${doorsScored} DOORS! +${Math.floor(fogPushback)}m LEAD`);
    } else {
      this._showPickupMsg('RUSH OVER!');
    }

    if (this.debugMode) {
      console.log(`[DEBUG] Power Rush exited | doors=${doorsScored} | fogPushback=${fogPushback}`);
    }
  }

  // ── Pickup effects ────────────────────────────────────────────────────────
  applyPickup(type) {
    switch (type) {
      case 'speed':
        this.speedBoostTimer = 4;
        break;
      case 'dash':
        this.marble.vy = Math.min(this.marble.vy + 500, MAX_SPEED_Y * this._fallMult());
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
      case 'power_rush':
        this._enterPowerRush();
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

    if (this.powerRushActive) {
      // ── Power Rush rendering ─────────────────────────────────────────────
      this._renderPowerRushBg(ctx);
      this.powerRushTrack.render(ctx, this.cameraY);
      for (const obs of this.powerRushObstacles) obs.render(ctx, this.cameraY);
    } else {
      // ── Normal rendering ─────────────────────────────────────────────────
      this._renderSynthwaveBg(ctx);
      this._renderStars(ctx);
      this.track.render(ctx, this.cameraY);
      for (const obs of this.obstacles) obs.render(ctx, this.cameraY);
      for (const pu of this.pickups) pu.render(ctx, this.cameraY);
      this._renderRushLine(ctx);
    }

    // Particles (screen space – always rendered)
    for (const p of this.particles) {
      const sy = p.y - this.cameraY;
      ctx.beginPath();
      ctx.arc(p.x, sy, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,200,255,${p.life * 0.8})`;
      ctx.fill();
    }

    // Fog – hidden during Power Rush (it's paused; don't distract the player)
    if (!this.powerRushActive) {
      this.fog.render(ctx, this.cameraY);
    }

    // Marble (world space – translate by -cameraY)
    ctx.save();
    ctx.translate(0, -this.cameraY);
    this._renderMarble(ctx);
    ctx.restore();

    // ── Screen-space overlays ───────────────────────────────────────────────

    if (this.powerRushActive) {
      // Power Rush HUD (timer bar, door count, 3-2-1 countdown)
      this._renderPowerRushOverlay(ctx);
    } else if (this.state === STATE.RUNNING) {
      // Danger vignette when fog is close
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

  // ── Power Rush background ─────────────────────────────────────────────────
  _renderPowerRushBg(ctx) {
    // Deep electric-gold sky
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0,    '#060400');
    sky.addColorStop(0.35, '#120900');
    sky.addColorStop(0.65, '#1a0e00');
    sky.addColorStop(1,    '#0e0700');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Scrolling horizontal scan-lines in gold
    const scroll = (this.cameraY % 44) / 44;
    for (let i = 0; i < 14; i++) {
      const t     = (i + scroll) / 14;
      const ly    = t * CANVAS_H;
      const alpha = 0.04 + (1 - t) * 0.18;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(CANVAS_W, ly);
      ctx.strokeStyle = `rgba(255,180,0,${alpha.toFixed(3)})`;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    }

    // Stars – seeded per camera bucket, golden palette
    const bucket = Math.floor(this.cameraY / CANVAS_H);
    const seed   = bucket * 9876543;
    const colors = [
      [255, 200,  0],
      [255, 140,  0],
      [255, 240, 80],
      [255, 255, 160],
    ];
    for (let i = 0; i < 28; i++) {
      const sx   = pseudoRand(seed + i * 7)     * CANVAS_W;
      const sy   = pseudoRand(seed + i * 7 + 1) * CANVAS_H;
      const r    = pseudoRand(seed + i * 7 + 2) * 1.2 + 0.4;
      const a    = pseudoRand(seed + i * 7 + 3) * 0.5 + 0.1;
      const ci   = Math.floor(pseudoRand(seed + i * 7 + 4) * colors.length);
      const [cr, cg, cb] = colors[ci];
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.fill();
    }
  }

  // ── Power Rush HUD overlay ────────────────────────────────────────────────
  _renderPowerRushOverlay(ctx) {
    ctx.save();

    // Title banner
    ctx.font         = 'bold 16px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor  = '#ff8800';
    ctx.shadowBlur   = 14;
    ctx.fillStyle    = '#ffcc00';
    ctx.fillText('⚡ POWER RUSH ⚡', CANVAS_W / 2, 8);
    ctx.shadowBlur   = 0;

    // Timer bar
    const timeLeft = Math.max(0, this.powerRushTimer);
    const timeFrac = timeLeft / POWER_RUSH_DURATION;
    const barX = 20, barY = 30, barW = CANVAS_W - 40, barH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = timeFrac > 0.3 ? '#ffcc00' : '#ff4400';
    ctx.fillRect(barX, barY, barW * timeFrac, barH);
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth   = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Timer label (right of bar)
    ctx.font         = 'bold 12px monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#ffdd88';
    ctx.fillText(`${timeLeft.toFixed(1)}s`, barX + barW, barY + barH + 3);

    // Door count (left of bar)
    ctx.textAlign    = 'left';
    ctx.fillStyle    = '#88ffaa';
    ctx.fillText(`⚡ ${this.powerRushDoors}`, barX, barY + barH + 3);

    // Combo multiplier (right of door count, shown when active)
    if (this.doorCombo >= 2) {
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 120);
      ctx.fillStyle = `rgba(255,220,0,${pulse})`;
      ctx.fillText(`  x${this.doorCombo} COMBO`, barX + 60, barY + barH + 3);
    }

    // 3-2-1 countdown (big centred)
    if (this.powerRushCountdown > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
      ctx.font         = `bold ${Math.floor(90 + pulse * 14)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = '#ff8800';
      ctx.shadowBlur   = 30 + pulse * 20;
      ctx.fillStyle    = `rgba(255,220,0,${0.7 + pulse * 0.3})`;
      ctx.fillText(String(this.powerRushCountdown), CANVAS_W / 2, CANVAS_H / 2);
      ctx.shadowBlur   = 0;
    }

    ctx.restore();
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
      { text: '' },
      { text: 'POWER RUSH', color: '#ffcc00' },
      { text: `  active=${this.powerRushActive}`, color: '#ffeeaa' },
      { text: `  timer=${this.powerRushTimer.toFixed(2)} s  cd=${this.powerRushCountdown}`, color: '#ffeeaa' },
      { text: `  doors=${this.powerRushDoors}  nextAt=${this.nextPowerRushDist}m`, color: '#ffeeaa' },
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

  // ── Rush-line bolt helpers ────────────────────────────────────────────────
  // Rebuild pre-computed zigzag bolt paths for the orange electric rush line.
  _rebuildRushLineBolts() {
    const worldY          = this._rushLineWorldY;
    const { left, right } = this.track.getWallsAtY(worldY);
    this._rushLineBolts = [];
    // 3 bolt layers: main bolt + 2 thinner harmonics
    for (let b = 0; b < 3; b++) {
      const yBase = (b - 1) * 4;
      const segs  = 10 + b * 2;
      const amp   = 10 - b * 2;
      const pts   = [{ x: left, y: yBase }];
      for (let j = 1; j < segs; j++) {
        pts.push({
          x: left + (j / segs) * (right - left),
          y: yBase + (Math.random() - 0.5) * amp * 2,
        });
      }
      pts.push({ x: right, y: yBase });
      this._rushLineBolts.push({ bolt: b, pts });
    }
  }

  // Draw the orange electric trigger line at the next power-rush world-Y.
  _renderRushLine(ctx) {
    const worldY  = this._rushLineWorldY;
    const screenY = worldY - this.cameraY;

    // Only draw when within the visible viewport (with some lead-in margin)
    if (screenY < -120 || screenY > CANVAS_H + 40) return;

    const { left, right } = this.track.getWallsAtY(worldY);
    const t     = Date.now();
    const sinP  = Math.sin(t / 220);
    const pulse = 0.55 + 0.45 * sinP;
    const glow  = 22 + 14 * sinP;

    ctx.save();

    // Soft orange electric-field fill behind the line
    const fieldGrad = ctx.createLinearGradient(left, screenY - 22, left, screenY + 22);
    const fa = 0.10 + 0.08 * sinP;
    fieldGrad.addColorStop(0,   'rgba(255,100,0,0)');
    fieldGrad.addColorStop(0.5, `rgba(255,130,0,${fa})`);
    fieldGrad.addColorStop(1,   'rgba(255,100,0,0)');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(left, screenY - 22, right - left, 44);

    // Electric zigzag bolt layers
    for (const { bolt: b, pts } of this._rushLineBolts) {
      const alpha = 0.85 - b * 0.18 + 0.15 * sinP;
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur  = glow * (b === 0 ? 1 : 0.5);
      ctx.strokeStyle = b === 0
        ? `rgba(255,180,0,${alpha})`
        : `rgba(255,${120 + b * 30},0,${alpha * 0.75})`;
      ctx.lineWidth   = b === 0 ? 3 : 1.4;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      ctx.beginPath();
      ctx.moveTo(pts[0].x, screenY + pts[0].y);
      for (let k = 1; k < pts.length; k++) {
        ctx.lineTo(pts[k].x, screenY + pts[k].y);
      }
      ctx.stroke();
    }

    // Endpoint spark nodes
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = `rgba(255,180,0,${0.7 + 0.3 * pulse})`;
    for (const nx of [left, right]) {
      ctx.beginPath();
      ctx.arc(nx, screenY, 4 + sinP * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // "⚡ RUSH ⚡" label above the line
    ctx.font         = 'bold 11px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle    = `rgba(255,210,80,${0.6 + 0.4 * pulse})`;
    ctx.shadowColor  = '#ff8800';
    ctx.shadowBlur   = 10;
    ctx.fillText('⚡ RUSH ⚡', (left + right) / 2, screenY - 10);

    ctx.restore();
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
