// ── Game ─────────────────────────────────────────────────────────────────────

const STATE = { MENU: 'menu', RUNNING: 'running', DEAD: 'dead', SHOP: 'shop', PVP_OVER: 'pvp_over' };

// World-units between successive content-generation passes
const GEN_SEGMENT = 500;

// Pickup spawn rate: one pickup per this many world-units on average
const PICKUP_RATE = 900;

// Pickup type weights [speed, magnet, fog_slow, shield, ghost]
const PICKUP_WEIGHTS = [0.28, 0.22, 0.22, 0.10, 0.18];
const PICKUP_TYPES   = ['speed', 'magnet', 'fog_slow', 'shield', 'ghost'];
const POWER_RUSH_CORRIDOR_LEFT  = 100;   // fixed left wall X during rush
const POWER_RUSH_CORRIDOR_RIGHT = 380;   // fixed right wall X during rush
const POWER_RUSH_DURATION       = 10;    // seconds the rush phase lasts
const POWER_RUSH_DOOR_SPACING   = 600;   // world-units between successive door gates
const POWER_RUSH_PICKUP_SPACING     = 1100;  // world-units between rush-extend pickups
const POWER_RUSH_EXTEND_MAX         = 10;    // max total seconds that rush_extend pickups can add
const POWER_RUSH_BLITZ_DURATION     = 0.5;  // seconds the ball is frozen by a blitz strike
const POWER_RUSH_PICKUP_START_OFFSET = 650;  // world-units ahead before first rush pickup appears
const POWER_RUSH_PUSH_PER_DOOR  = 100;   // extra world-units of fog pushback per door scored
const POWER_RUSH_BIG_COIN_SPACING = 350; // world-units between big coin spawns inside the corridor
const POWER_RUSH_INTERVAL            = 10000; // metres to the first power-rush trigger
const POWER_RUSH_SUBSEQUENT_INTERVAL = 15000; // metres between each subsequent power-rush
const NORMAL_DOOR_INTERVAL      = 5000;  // min world-units between normal-mode door gates

// PVP mode
const PVP_GOAL_DEFAULT  = 10000; // metres – default race distance

// Coin system
const SPEED_BOOST_ACCELERATION = 220;  // extra downward acceleration (units/s²) while speed boost is active
const COIN_SPACING      = 300;  // average world-units between coin spawns
const BLUE_COIN_SPACING = 1800; // average world-units between blue coin spawns (rare, worth 3)
const RED_COIN_SPACING  = 3500; // average world-units between red coin spawns (very rare, worth 5)
const COIN_VALUE   = 50;   // metres bonus per collected coin

// ── Shop ─────────────────────────────────────────────────────────────────────
const SHOP_ITEMS = {
  void_push: { cost: 20, name: 'Void Push'  },
  magnet:    { cost: 5,  name: 'Magnet'     },
};

// ── Achievements ─────────────────────────────────────────────────────────────
const ACHIEVEMENT_DEFS = [
  { id: 'reach_1000m',      icon: '🦶', name: 'First Steps',       desc: 'Reach 1,000m in a single run'                         },
  { id: 'reach_5000m',      icon: '🚀', name: 'Speed Seeker',      desc: 'Reach 5,000m in a single run'                         },
  { id: 'reach_10000m',     icon: '🏃', name: 'Marathon',          desc: 'Reach 10,000m in a single run'                        },
  { id: 'reach_25000m',     icon: '👹', name: 'Speed Demon',       desc: 'Reach 25,000m in a single run'                        },
  { id: 'reach_50000m',     icon: '🌟', name: 'Hypersonic',         desc: 'Reach 50,000m in a single run'                        },
  { id: 'reach_75000m',     icon: '🔮', name: 'Transcendent',       desc: 'Reach 75,000m in a single run'                        },
  { id: 'reach_100000m',    icon: '💫', name: 'Legendary',          desc: 'Reach 100,000m in a single run'                       },
  { id: 'reach_150000m',    icon: '🌀', name: 'Unstoppable',        desc: 'Reach 150,000m in a single run'                       },
  { id: 'reach_200000m',    icon: '☄️', name: 'Godspeed',           desc: 'Reach 200,000m in a single run'                       },
  { id: 'reach_250000m',    icon: '🏅', name: 'The Infinite Run',   desc: 'Reach 250,000m in a single run'                       },
  { id: 'coin_hoarder',     icon: '💰', name: 'Coin Hoarder',      desc: 'Collect 10 coins in a single run'                     },
  { id: 'treasure_hunter',  icon: '💎', name: 'Treasure Hunter',   desc: 'Collect 50 coins in a single run'                     },
  { id: 'power_up',         icon: '⭐', name: 'Power Up!',         desc: 'Collect your first pickup'                            },
  { id: 'iron_shell',       icon: '🛡', name: 'Iron Shell',        desc: 'Block the Void with a shield'                         },
  { id: 'rush_veteran',     icon: '🔥', name: 'Rush Veteran',      desc: 'Complete 3 Power Rushes in a single run'              },
  { id: 'door_master',      icon: '🚪', name: 'Door Master',       desc: 'Score 10 doors across all Power Rushes in one run'    },
  { id: 'combo_striker',    icon: '🎯', name: 'Combo Striker',     desc: 'Achieve a 3× door combo in Power Rush'                },
  { id: 'clean_power_rush', icon: '⚡', name: 'Untouchable Rush',  desc: 'Complete Power Rush without getting Blitzed'          },
];

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

// ── LaserBeam ─────────────────────────────────────────────────────────────────
// A horizontal laser beam that sweeps the Power Rush corridor, leaving one gap
// that the player must steer into.  Charges for 0.75 s (telegraph), then fires
// for 1.4 s before expiring.
class LaserBeam {
  constructor(worldY) {
    this.worldY = worldY;
    this.h      = 14;          // collision height (px)

    // Divide the corridor into 3 equal zones; place the gap in a random zone.
    const corridorW = POWER_RUSH_CORRIDOR_RIGHT - POWER_RUSH_CORRIDOR_LEFT;
    this.gapW = Math.round(corridorW * POWER_RUSH_LASER_GAP_RATIO);  // tight but passable gap
    const slot  = Math.floor(Math.random() * 3); // 0 = left, 1 = centre, 2 = right
    const zoneW = corridorW / 3;
    this.gapX   = POWER_RUSH_CORRIDOR_LEFT + slot * zoneW + (zoneW - this.gapW) / 2;

    this.chargeTime   = 0.75;
    this.activeTime   = 1.4;
    this._chargeTimer = 0;    // dormant until triggered
    this._activeTimer = 0;
    this.triggered    = false; // starts dormant; activated by proximity
    this.expired      = false;
    this.pulse        = Math.random() * Math.PI * 2;
    this._hitCooldown = 0;   // brief cooldown to prevent multi-hit per pass
  }

  /** Called once when the marble comes within POWER_RUSH_LASER_TRIGGER_DIST. */
  trigger() {
    if (this.triggered) return;
    this.triggered    = true;
    this._chargeTimer = this.chargeTime;
  }

  get state() {
    if (this.expired)           return 'expired';
    if (!this.triggered)        return 'dormant';
    if (this._chargeTimer > 0)  return 'charging';
    if (this._activeTimer > 0)  return 'active';
    return 'expired';
  }

  update(dt) {
    this.pulse = (this.pulse + dt * 4.5) % (Math.PI * 2);
    if (this._hitCooldown > 0) this._hitCooldown -= dt;

    if (!this.triggered) return; // dormant – wait for proximity trigger

    if (this._chargeTimer > 0) {
      this._chargeTimer -= dt;
      if (this._chargeTimer <= 0) {
        this._chargeTimer = 0;
        this._activeTimer = this.activeTime;
      }
    } else if (this._activeTimer > 0) {
      this._activeTimer -= dt;
      if (this._activeTimer <= 0) this.expired = true;
    }
  }

  checkCollision(marble) {
    if (this.state !== 'active') return false;
    if (this._hitCooldown > 0)   return false;

    // Test left beam segment
    const leftW = this.gapX - POWER_RUSH_CORRIDOR_LEFT;
    if (leftW > 0) {
      const hit = circleRectCollision(
        marble.x, marble.y, marble.radius,
        POWER_RUSH_CORRIDOR_LEFT, this.worldY - this.h / 2, leftW, this.h
      );
      if (hit) { this._bounce(marble, hit); return true; }
    }

    // Test right beam segment
    const rightX = this.gapX + this.gapW;
    const rightW = POWER_RUSH_CORRIDOR_RIGHT - rightX;
    if (rightW > 0) {
      const hit = circleRectCollision(
        marble.x, marble.y, marble.radius,
        rightX, this.worldY - this.h / 2, rightW, this.h
      );
      if (hit) { this._bounce(marble, hit); return true; }
    }

    return false;
  }

  _bounce(marble, hit) {
    // Push marble out of beam and reflect off the horizontal surface
    marble.x += hit.nx * hit.depth;
    marble.y += hit.ny * hit.depth;
    const dot = marble.vx * hit.nx + marble.vy * hit.ny;
    marble.vx = (marble.vx - 2 * dot * hit.nx) * 0.55;
    marble.vy = (marble.vy - 2 * dot * hit.ny) * 0.55;
    // Random horizontal kick so the direction noticeably changes
    marble.vx += (Math.random() - 0.5) * 280;
    marble.triggerShake();
    this._hitCooldown = 0.3;
  }

  render(ctx, cameraY) {
    const sy = this.worldY - cameraY;
    if (sy < -30 || sy > CANVAS_H + 30) return;
    const s = this.state;
    if (s === 'expired' || s === 'dormant') return;

    const sinP  = Math.sin(this.pulse);
    const pulse = 0.5 + 0.5 * sinP;

    ctx.save();
    ctx.lineCap = 'round';

    if (s === 'charging') {
      const chargeFrac = 1 - this._chargeTimer / this.chargeTime;

      // Dashed preview of blocked segments – grows more urgent as charge builds
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur  = 4 + chargeFrac * 8;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth   = 2 + chargeFrac * 1.5;
      const alpha     = 0.15 + chargeFrac * 0.30 + pulse * 0.05;
      ctx.strokeStyle = `rgba(255,60,0,${alpha})`;

      const leftW = this.gapX - POWER_RUSH_CORRIDOR_LEFT;
      if (leftW > 0) {
        ctx.beginPath();
        ctx.moveTo(POWER_RUSH_CORRIDOR_LEFT, sy);
        ctx.lineTo(this.gapX, sy);
        ctx.stroke();
      }
      const rightX = this.gapX + this.gapW;
      if (rightX < POWER_RUSH_CORRIDOR_RIGHT) {
        ctx.beginPath();
        ctx.moveTo(rightX, sy);
        ctx.lineTo(POWER_RUSH_CORRIDOR_RIGHT, sy);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Green dotted safe-gap indicator
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur  = 4 + chargeFrac * 6;
      ctx.strokeStyle = `rgba(80,255,130,${0.4 + chargeFrac * 0.25})`;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(this.gapX, sy);
      ctx.lineTo(this.gapX + this.gapW, sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pulsing warning dot on the left wall
      const dotR = 3 + chargeFrac * 3 + pulse * 1.5;
      ctx.fillStyle   = `rgba(255,80,0,${0.5 + chargeFrac * 0.4})`;
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur  = 10 + chargeFrac * 8;
      ctx.beginPath();
      ctx.arc(POWER_RUSH_CORRIDOR_LEFT, sy, dotR, 0, Math.PI * 2);
      ctx.fill();

    } else if (s === 'active') {
      const elapsed = this.activeTime - this._activeTimer;
      const fadeIn  = Math.min(1, elapsed / 0.12);
      const baseA   = fadeIn * (0.75 + pulse * 0.25);
      const glow    = 18 + pulse * 14;

      ctx.lineWidth = 5 + pulse * 2;

      const leftW = this.gapX - POWER_RUSH_CORRIDOR_LEFT;
      if (leftW > 0) {
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur  = glow;
        ctx.strokeStyle = `rgba(255,80,0,${baseA})`;
        ctx.beginPath();
        ctx.moveTo(POWER_RUSH_CORRIDOR_LEFT, sy);
        ctx.lineTo(this.gapX, sy);
        ctx.stroke();
      }

      const rightX = this.gapX + this.gapW;
      const rightW = POWER_RUSH_CORRIDOR_RIGHT - rightX;
      if (rightW > 0) {
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur  = glow;
        ctx.strokeStyle = `rgba(255,80,0,${baseA})`;
        ctx.beginPath();
        ctx.moveTo(rightX, sy);
        ctx.lineTo(POWER_RUSH_CORRIDOR_RIGHT, sy);
        ctx.stroke();
      }

      // Spark endpoint nodes on the corridor walls
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur  = 14;
      ctx.fillStyle   = `rgba(255,160,0,${0.8 + pulse * 0.2})`;
      for (const nx of [POWER_RUSH_CORRIDOR_LEFT, POWER_RUSH_CORRIDOR_RIGHT]) {
        ctx.beginPath();
        ctx.arc(nx, sy, 4 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Faint safe-gap line
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur  = 3;
      ctx.strokeStyle = 'rgba(100,255,150,0.28)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(this.gapX, sy);
      ctx.lineTo(this.gapX + this.gapW, sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}

// ── BotMarble ─────────────────────────────────────────────────────────────────
// An autonomous opponent marble for PVP mode. Uses the same physics as Marble
// but has an AI steering controller. Rendered in a dark void-creature style.
const BOT_NAMES        = ['Shadow', 'Gloom', 'Wraith'];
const BOT_COLORS       = [
  { body: '#1a0030', glow: '120,0,200',   trail: '80,0,160'   },
  { body: '#001a20', glow: '0,180,160',   trail: '0,100,120'  },
  { body: '#200010', glow: '200,0,80',    trail: '120,0,60'   },
];

class BotMarble {
  constructor(x, y, index, startY, difficulty = 'normal') {
    this.marble   = new Marble(x, y);
    this.index    = index;
    this.name     = BOT_NAMES[index % BOT_NAMES.length];
    this.colors   = BOT_COLORS[index % BOT_COLORS.length];
    this.startY   = startY;
    this.finished = false;
    this.finishDist = 0;
    this.finishTime = 0;

    // Difficulty-based base parameters
    let baseAggression, baseSteerChange, gravFactor;
    if (difficulty === 'easy') {
      baseAggression  = 0.20;
      baseSteerChange = 0.60;
      gravFactor      = 0.72;
    } else if (difficulty === 'hard') {
      baseAggression  = 0.75;
      baseSteerChange = 0.12;
      gravFactor      = 1.15;
    } else { // normal
      baseAggression  = 0.50;
      baseSteerChange = 0.30;
      gravFactor      = 0.90;
    }
    this._gravFactor = gravFactor;

    // AI state
    this._steerTimer = 0;
    this._steerDir   = 0;   // -1, 0, +1
    this._downTimer  = 0;
    this._downActive = false;

    // Slight per-bot personality variation within the difficulty band
    this._aggression  = baseAggression  + index * 0.05;
    this._steerChange = baseSteerChange + index * 0.05;
  }

  get distance() {
    return Math.max(0, Math.floor(this.marble.y - this.startY));
  }

  update(dt, track, steerMult, gravMult) {
    if (this.finished) return;

    // ── Steering AI ─────────────────────────────────────────────────────────
    this._steerTimer -= dt;
    if (this._steerTimer <= 0) {
      this._steerTimer = this._steerChange + Math.random() * 0.4;
      this._chooseSteer(track);
    }

    // ── Boost AI ─────────────────────────────────────────────────────────────
    this._downTimer -= dt;
    if (this._downTimer <= 0) {
      this._downActive = Math.random() < this._aggression;
      this._downTimer  = 0.2 + Math.random() * 0.5;
    }

    const input = {
      left:  this._steerDir < 0,
      right: this._steerDir > 0,
      up:    false,
      down:  this._downActive,
    };

    this.marble.update(dt, input, track, steerMult, gravMult * this._gravFactor);
  }

  _chooseSteer(track) {
    const { left, right } = track.getWallsAtY(this.marble.y);
    const margin = 35;
    if (this.marble.x - left   < margin) { this._steerDir =  1; return; }
    if (right - this.marble.x  < margin) { this._steerDir = -1; return; }
    // Bias toward track centre
    const centre = (left + right) / 2;
    const bias   = (this.marble.x - centre) / (right - left); // -0.5..+0.5
    const r      = Math.random() - 0.5 - bias * 0.6;
    this._steerDir = r > 0.18 ? 1 : r < -0.18 ? -1 : 0;
  }

  render(ctx, cameraY) {
    const m   = this.marble;
    const col = this.colors;

    // Trail
    ctx.save();
    ctx.translate(0, -cameraY);
    for (let i = 0; i < m.trail.length; i++) {
      const alpha = (i / m.trail.length) * 0.3;
      const r     = m.radius * (i / m.trail.length) * 0.65;
      ctx.beginPath();
      ctx.arc(m.trail[i].x, m.trail[i].y, Math.max(r, 1), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col.trail},${alpha})`;
      ctx.fill();
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + m.radius * 0.6, m.radius * 0.9, m.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // Dark body with void gradient
    const grad = ctx.createRadialGradient(
      m.x - m.radius * 0.3, m.y - m.radius * 0.35, m.radius * 0.08,
      m.x, m.y, m.radius
    );
    grad.addColorStop(0,    '#3a005a');
    grad.addColorStop(0.45, col.body);
    grad.addColorStop(1,    '#000005');
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glow ring
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * 1.55, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${col.glow},0.35)`;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // Two glowing eyes
    const eyeY = m.y - m.radius * 0.18;
    const eyeOff = m.radius * 0.28;
    const pulse  = 0.6 + 0.4 * Math.sin(Date.now() / 300 + this.index * 1.3);
    for (let s = -1; s <= 1; s += 2) {
      const ex = m.x + s * eyeOff;
      const ey = eyeY;
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col.glow},${pulse})`;
      ctx.shadowColor = `rgba(${col.glow},0.8)`;
      ctx.shadowBlur  = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

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
    this.pvpMode = false;  // true while in PVP mode
    this._pvpDifficulty   = 'normal'; // difficulty for PVP bot opponents
    this._pvpGoalDistance = PVP_GOAL_DEFAULT; // metres – first racer to reach this wins
    this._init();

    this.ui.showStart((voidSpeedPct) => {
      this._applyVoidRate(voidSpeedPct);
      // Map difficulty button value to PVP bot difficulty
      if (voidSpeedPct === 125) this._pvpDifficulty = 'easy';
      else if (voidSpeedPct === 175) this._pvpDifficulty = 'hard';
      else this._pvpDifficulty = 'normal';
    }, () => { this.startRun(); });
    this.ui.updateBestDistance(this.bestDistance);

    // Wire up sound controls in the start overlay
    this._initSoundControls();

    // Wire up steering sensitivity controls in the start overlay
    this._initSteerControls();

    // Wire up fall speed controls in the start overlay
    this._initFallSpeedControls();

    // Wire up void speed controls in the start overlay
    this._initVoidRateControls();

    // Achievements – loaded once and persisted across runs
    this._achievements = this._loadAchievements();

    // Wire up the in-game shop button and shop overlay
    this._initShop();

    // Wire up the achievements overlay accessible from the start menu
    this._initAchievementsUI();

    // Wire up the PVP button
    this._initPvpButton();

    // Wire up the PVP goal distance slider
    this._initPvpGoalSlider();
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
  // Speed-boost pickup temporarily raises the multiplier.
  _fallMult() {
    let m = this._fallSpeedSetting / 100;
    if (this.speedBoostTimer > 0) m *= 1.5;   // 50% speed boost
    return m;
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

  // Applies a void rate value (e.g. from a difficulty button) and syncs the slider UI.
  _applyVoidRate(voidSpeedPct) {
    voidSpeedPct = Math.max(10, Math.min(200, voidSpeedPct));
    this._voidRateSetting = voidSpeedPct;
    localStorage.setItem('mrVoidRate', String(voidSpeedPct));
    const slider  = document.getElementById('void-rate-slider');
    const valueEl = document.getElementById('void-rate-value');
    if (slider)  { slider.value = voidSpeedPct; slider.style.setProperty('--val', `${(voidSpeedPct - 10) / 190 * 100}%`); }
    if (valueEl) { valueEl.textContent = voidSpeedPct; }
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
    this.magnetTimer     = 0;
    this.shieldTimer     = 0;
    this.ghostTimer      = 0;
    this.pickupMsg       = null; // { text, timer }

    // Coin system
    this.coins          = [];
    this.blueCoins      = [];
    this.redCoins       = [];
    this.coinsCollected = 0;
    this.coinFloats     = []; // floating "+N" labels shown on coin collection

    // Per-run achievement tracking
    this._rushBlitzes        = 0;   // blitz hits during the current Power Rush
    this._rushesCompleted    = 0;   // Power Rushes fully completed this run
    this._totalDoorsScored   = 0;   // doors scored across all rushes this run
    this._maxDoorCombo       = 0;   // highest door combo reached this run
    this._pickupCollected    = false; // whether any pickup was collected this run
    this._shieldUsed         = false; // whether a shield block occurred this run

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
    this.powerRushExtended  = 0;   // total seconds added via rush_extend pickups (capped at POWER_RUSH_EXTEND_MAX)
    this.blitzTimer         = 0;   // >0 while the marble is frozen by a blitz strike
    this._blitzBolts        = [];  // pre-generated lightning bolt points for blitz animation
    this.powerRushTrack     = new PowerRushTrack();
    this.powerRushObstacles  = [];
    this.powerRushPickups    = [];   // rush-extend pickups inside the corridor
    this.powerRushPickupCount = 0;  // total rush-extend pickups spawned this rush (max 3 to prevent excessive duration)
    this.powerRushBigCoins   = [];  // big coins inside the corridor during rush
    this.powerRushGenY       = 0;   // generation cursor for rush door gates
    this.powerRushPickupGenY = 0;   // generation cursor for rush-extend pickups
    this.powerRushBigCoinGenY = 0;  // generation cursor for big coins
    this.nextPowerRushDist   = POWER_RUSH_INTERVAL; // distance at which next pickup spawns

    // Rush-line electric animation state
    this._rushLineFlickerTimer = 0;
    this._rushLineBolts        = [];
    this._rushLineWorldY       = this.track.startY + POWER_RUSH_INTERVAL; // cached trigger Y

    // ── PVP state ──────────────────────────────────────────────────────────
    this.pvpBots         = [];  // BotMarble instances
    this._pvpFinishers   = [];  // order in which racers finished {name, dist, isPlayer}

    // Pre-populate the first stretch of content
    this._extendLevel(this.track.startY + 1800);
  }

  startRun() {
    this.pvpMode = false;
    this._init();
    this.state = STATE.RUNNING;
    this.ui.setPvpHud(false);
    this.ui.updateDistance(0);
    this.ui.updateVoidDistance('--');
    this.ui.updateTimer(0);
    this.ui.updateCoinCount(0);
    if (this.debugMode) console.log('[DEBUG] Run started');
    this.sound.start();
  }

  restart() {
    this.ui.hideGameOver();
    this.startRun();
  }

  // ── PVP mode ───────────────────────────────────────────────────────────────
  startPvpRun() {
    this.pvpMode = true;
    this._init();

    // Spawn 3 bots spread slightly around the player start X
    const sx = this.track.startX;
    const sy = this.track.startY;
    const offsets = [-28, 0, 28]; // horizontal offsets
    for (let i = 0; i < 3; i++) {
      this.pvpBots.push(new BotMarble(sx + offsets[i], sy, i, sy, this._pvpDifficulty));
    }

    this.state = STATE.RUNNING;
    this.ui.setPvpHud(true);
    this.ui.updateTimer(0);
    if (this.debugMode) console.log('[DEBUG] PVP run started');
    this.sound.start();
  }

  _initPvpButton() {
    const pvpBtn = document.getElementById('pvp-btn');
    if (pvpBtn) {
      pvpBtn.addEventListener('click', () => {
        // Hide the start overlay then begin PVP
        const overlay = document.getElementById('overlay');
        if (overlay) { overlay.classList.remove('visible'); overlay.classList.add('hidden'); }
        this.startPvpRun();
      });
    }
  }

  _initPvpGoalSlider() {
    const slider  = document.getElementById('pvp-goal-slider');
    const valueEl = document.getElementById('pvp-goal-value');
    if (!slider || !valueEl) return;

    const apply = (v) => {
      this._pvpGoalDistance = v;
      valueEl.textContent   = v.toLocaleString();
      // CSS custom property drives the slider fill (0–100 %)
      const pct = (v - 10000) / (50000 - 10000) * 100;
      slider.style.setProperty('--val', `${pct}%`);
    };

    slider.value = this._pvpGoalDistance;
    apply(this._pvpGoalDistance);

    slider.addEventListener('input', () => {
      apply(parseInt(slider.value, 10));
    });
  }

  _pvpGameOver() {
    this.state = STATE.PVP_OVER;

    const playerFinished = this.distance >= this._pvpGoalDistance;

    // Build rankings with finish time for those who completed the race
    const entries = [
      { name: 'You', dist: this.distance, time: this.elapsed, finished: playerFinished, isPlayer: true },
      ...this.pvpBots.map(b => ({ name: b.name, dist: b.distance, time: b.finishTime, finished: b.finished, isPlayer: false })),
    ];
    // Finishers rank above DNFs; finishers sorted by time asc, DNFs by distance desc
    entries.sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.time - b.time;
      return b.dist - a.dist;
    });

    const playerWon = entries[0].isPlayer;
    this.ui.showPvpResult(
      playerWon,
      entries,
      () => { this.startPvpRun(); },
      () => {
        this.pvpMode = false;
        this._init();
        this.state = STATE.MENU;
        this.ui.setPvpHud(false);
        const overlay = document.getElementById('overlay');
        if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('visible'); }
      }
    );
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

    // In shop state the game is paused; Escape/R closes the shop
    if (this.state === STATE.SHOP) {
      if (this.input.consumeRestart()) this.closeShop();
      return;
    }

    if (this.state !== STATE.RUNNING) return;

    if (this.input.consumeRestart()) {
      if (this.pvpMode) { this.startPvpRun(); } else { this.restart(); }
      return;
    }

    this.elapsed += dt * 1000;

    // ── Power Rush Mode – disabled in PVP ───────────────────────────────────
    // Auto-trigger every POWER_RUSH_INTERVAL metres instead of via a pickup
    if (!this.pvpMode && !this.powerRushActive && this.distance > 0 && this.distance >= this.nextPowerRushDist) {
      this.nextPowerRushDist += POWER_RUSH_SUBSEQUENT_INTERVAL;
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

    // Speed-boost pickup: extra downward push (cap uses boosted _fallMult)
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      this.marble.vy = Math.min(this.marble.vy + SPEED_BOOST_ACCELERATION * dt, MAX_SPEED_Y * this._fallMult());
    }

    // Magnet timer
    if (this.magnetTimer > 0) this.magnetTimer -= dt;

    // ── Fog (normal mode only) ───────────────────────────────────────────────
    if (!this.pvpMode) {
      this.fog.update(dt, this.distance, this._voidRateMult());

      if (this.fog.isCatching(this.marble)) {
        if (this.shieldTimer > 0) {
          // Consume the shield and push the fog back
          this.shieldTimer = 0;
          this.fog.y = this.marble.y - 480;
          this._showPickupMsg('SHIELD USED!');
          if (!this._shieldUsed) {
            this._shieldUsed = true;
            this._grantAchievement('iron_shell');
          }
        } else {
          this._gameOver();
          return;
        }
      }
    }
    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    // ── Bot marbles (PVP mode) ───────────────────────────────────────────────
    if (this.pvpMode) {
      const steer = this._steerMult();
      const grav  = this._fallMult();
      for (const bot of this.pvpBots) {
        bot.update(dt, this.track, steer, grav);
        // Check if bot reached goal distance
        if (!bot.finished && bot.distance >= this._pvpGoalDistance) {
          bot.finished   = true;
          bot.finishDist = bot.distance;
          bot.finishTime = this.elapsed;
        }
      }

      // Check if player reached the goal or any bot has finished (first to goal wins)
      const playerDone = this.distance >= this._pvpGoalDistance;
      const anyBotDone = this.pvpBots.some(b => b.finished);
      if (playerDone || anyBotDone) {
        this._pvpGameOver();
        return;
      }
    }

    // ── Obstacles ───────────────────────────────────────────────────────────
    for (const obs of this.obstacles) {
      obs.update(dt);
      if (this.ghostTimer <= 0) obs.checkCollision(this.marble);
      // Bots are always affected by obstacles (no ghost pickup for them)
      if (this.pvpMode) {
        for (const bot of this.pvpBots) {
          if (!bot.finished) obs.checkCollision(bot.marble);
        }
      }
    }
    if (this.ghostTimer > 0) this.ghostTimer -= dt;

    // ── Pickups ─────────────────────────────────────────────────────────────
    for (const pu of this.pickups) {
      pu.update(dt);
      pu.checkCollision(this.marble, this);
    }

    // ── Coins ────────────────────────────────────────────────────────────────
    for (const coin of this.coins) {
      coin.update(dt);
      coin.checkCollision(this.marble, this, dt);
    }
    for (const bc of this.blueCoins) {
      bc.update(dt);
      bc.checkCollision(this.marble, this, dt);
    }
    for (const rc of this.redCoins) {
      rc.update(dt);
      rc.checkCollision(this.marble, this, dt);
    }

    // Pickup message fade
    if (this.pickupMsg) {
      this.pickupMsg.timer -= dt;
      if (this.pickupMsg.timer <= 0) this.pickupMsg = null;
    }
    this._updateCoinFloats(dt);

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
    if (!this.pvpMode) {
      this.ui.updateDistance(this.distance);
      this.ui.updateVoidDistance(Math.max(0, Math.floor(this.marble.y - this.marble.radius - this.fog.y)));
    }
    this.ui.updateTimer(this.elapsed);

    // ── Achievement checks (normal mode only) ────────────────────────────────
    if (!this.pvpMode) {
      if (this.distance >= 1000)   this._grantAchievement('reach_1000m');
      if (this.distance >= 5000)   this._grantAchievement('reach_5000m');
      if (this.distance >= 10000)  this._grantAchievement('reach_10000m');
      if (this.distance >= 25000)  this._grantAchievement('reach_25000m');
      if (this.distance >= 50000)  this._grantAchievement('reach_50000m');
      if (this.distance >= 75000)  this._grantAchievement('reach_75000m');
      if (this.distance >= 100000) this._grantAchievement('reach_100000m');
      if (this.distance >= 150000) this._grantAchievement('reach_150000m');
      if (this.distance >= 200000) this._grantAchievement('reach_200000m');
      if (this.distance >= 250000) this._grantAchievement('reach_250000m');
    }

    // ── Rush-line bolt flicker (refresh every ~80 ms, normal mode only) ─────
    if (!this.pvpMode) {
      this._rushLineFlickerTimer -= dt;
      if (this._rushLineFlickerTimer <= 0) {
        this._rushLineFlickerTimer = 0.08;
        this._rebuildRushLineBolts();
      }
    }
  }

  // ── Power Rush update (replaces the main update while rush is active) ─────
  _updatePowerRush(dt) {
    // ── Blitz (electrified freeze) ──────────────────────────────────────────
    if (this.blitzTimer > 0) {
      this.blitzTimer -= dt;
      if (this.blitzTimer < 0) this.blitzTimer = 0;
      // Marble is frozen – rebuild bolt animation but skip physics
      if (Math.random() < dt * 20) this._rebuildBlitzBolts();
      // Camera still follows marble position (no movement so it stays stable)
      const targetCamY = this.marble.y - CANVAS_H * 0.28;
      this.cameraY = lerp(this.cameraY, targetCamY, clamp(dt * 7, 0, 1));
      this._updateParticles(dt);
      if (this.pickupMsg) {
        this.pickupMsg.timer -= dt;
        if (this.pickupMsg.timer <= 0) this.pickupMsg = null;
      }
      this._updateCoinFloats(dt);
      return; // skip everything else while frozen
    }

    // Marble physics – use the fixed-width power rush corridor
    this.marble.update(dt, this.input, this.powerRushTrack, this._steerMult(), this._fallMult());

    // Speed boost still applies inside rush (cap uses boosted _fallMult)
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      this.marble.vy = Math.min(this.marble.vy + SPEED_BOOST_ACCELERATION * dt, MAX_SPEED_Y * this._fallMult());
    }

    // Magnet timer
    if (this.magnetTimer > 0) this.magnetTimer -= dt;

    // Update door obstacles and check marble collisions
    for (const obs of this.powerRushObstacles) {
      obs.update(dt);
      obs.checkCollision(this.marble);
    }

    // Update rush-extend pickups and check collection
    for (const pu of this.powerRushPickups) {
      pu.update(dt);
      pu.checkCollision(this.marble, this);
    }

    // Update big coins and check collection
    for (const bc of this.powerRushBigCoins) {
      bc.update(dt);
      bc.checkCollision(this.marble, this, dt);
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
          if (this.doorCombo > this._maxDoorCombo) {
            this._maxDoorCombo = this.doorCombo;
            if (this._maxDoorCombo >= 3) this._grantAchievement('combo_striker');
          }
        } else {
          this.doorCombo = 0;
          this.powerRushFogBonus += POWER_RUSH_PUSH_PER_DOOR;
          // Blitz: electrify and freeze the marble for a short time
          this.blitzTimer = POWER_RUSH_BLITZ_DURATION;
          this._rushBlitzes++;
          this._rebuildBlitzBolts();
          this.marble.triggerShake();
          this.sound.playBlitz();
          this._showPickupMsg('⚡ BLITZ! ⚡');
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
    this._updateCoinFloats(dt);

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
    this.ui.updateTimer(this.elapsed);
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

    // Coins (one per ~COIN_SPACING world-units on average)
    const numCoins = Math.floor(segLen / COIN_SPACING) +
                     (Math.random() < (segLen % COIN_SPACING) / COIN_SPACING ? 1 : 0);
    for (let i = 0; i < numCoins; i++) {
      const cy = fromY + Math.random() * segLen;
      const { left: cl, right: cr } = this.track.getWallsAtY(cy);
      const margin = 14;
      const cx = cl + margin + Math.random() * Math.max(0, cr - cl - margin * 2);
      this.coins.push(new Coin(cx, cy));
    }

    // Blue coins (rarer, worth 3)
    if (Math.random() < segLen / BLUE_COIN_SPACING) {
      const cy = fromY + Math.random() * segLen;
      const { left: cl, right: cr } = this.track.getWallsAtY(cy);
      const margin = 14;
      const cx = cl + margin + Math.random() * Math.max(0, cr - cl - margin * 2);
      this.blueCoins.push(new BlueCoin(cx, cy));
    }

    // Red coins (very rare, worth 5)
    if (Math.random() < segLen / RED_COIN_SPACING) {
      const cy = fromY + Math.random() * segLen;
      const { left: cl, right: cr } = this.track.getWallsAtY(cy);
      const margin = 14;
      const cx = cl + margin + Math.random() * Math.max(0, cr - cl - margin * 2);
      this.redCoins.push(new RedCoin(cx, cy));
    }
  }

  _pruneEntities(behindY) {
    this.obstacles = this.obstacles.filter(o => o.worldY > behindY);
    this.pickups   = this.pickups.filter(p => !p.collected && p.worldY > behindY);
    this.coins     = this.coins.filter(c => !c.collected && c.worldY > behindY);
    this.blueCoins = this.blueCoins.filter(c => !c.collected && c.worldY > behindY);
    this.redCoins  = this.redCoins.filter(c => !c.collected && c.worldY > behindY);
    this.track.prune(behindY - 400);
  }

  // ── Power Rush helpers ────────────────────────────────────────────────────

  // Generate DoorGate obstacles, LaserBeams, and rush-extend pickups up to upToY
  _extendPowerRush(upToY) {
    const left  = POWER_RUSH_CORRIDOR_LEFT;
    const right = POWER_RUSH_CORRIDOR_RIGHT;

    // Door gates
    while (this.powerRushGenY < upToY) {
      this.powerRushObstacles.push(new DoorGate(this.powerRushGenY, left, right));
      this.powerRushGenY += POWER_RUSH_DOOR_SPACING;
    }

    // Rush-extend pickups (max 3 per rush, regardless of timer length)
    while (this.powerRushPickupGenY < upToY && this.powerRushPickupCount < 3) {
      const x = left + 30 + Math.random() * (right - left - 60);
      this.powerRushPickups.push(new Pickup(x, this.powerRushPickupGenY, 'rush_extend'));
      this.powerRushPickupCount++;
      this.powerRushPickupGenY += POWER_RUSH_PICKUP_SPACING;
    }

    // Big coins – scattered throughout the corridor
    while (this.powerRushBigCoinGenY < upToY) {
      const margin = 24;
      const x = left + margin + Math.random() * Math.max(0, right - left - margin * 2);
      this.powerRushBigCoins.push(new BigCoin(x, this.powerRushBigCoinGenY));
      this.powerRushBigCoinGenY += POWER_RUSH_BIG_COIN_SPACING * (0.75 + Math.random() * 0.5);
    }
  }

  _prunePowerRushObstacles(behindY) {
    this.powerRushObstacles = this.powerRushObstacles.filter(o => o.worldY > behindY);
    this.powerRushPickups   = this.powerRushPickups.filter(p => !p.collected && p.worldY > behindY);
    this.powerRushBigCoins  = this.powerRushBigCoins.filter(c => !c.collected && c.worldY > behindY);
  }

  _enterPowerRush() {
    this.powerRushActive    = true;
    this.powerRushTimer     = POWER_RUSH_DURATION;
    this.powerRushCountdown = 0;
    this.powerRushCdTimer   = 0;
    this.powerRushDoors     = 0;
    this.powerRushFogBonus  = 0;
    this.doorCombo          = 0;
    this.powerRushExtended  = 0;
    this.blitzTimer         = 0;

    // Clear normal obstacles/pickups so they don't interfere on return
    this.obstacles = [];
    this.pickups   = [];

    // Start generating door gates 200 units ahead of the marble
    this.powerRushObstacles  = [];
    this.powerRushPickups    = [];
    this.powerRushBigCoins   = [];
    this.powerRushPickupCount = 0;
    this.powerRushGenY        = this.marble.y + 200;
    // Pickups start further ahead so the player can settle into the corridor first
    this.powerRushPickupGenY  = this.marble.y + POWER_RUSH_PICKUP_START_OFFSET;
    // Big coins start a bit ahead too
    this.powerRushBigCoinGenY = this.marble.y + 300;

    this._showPickupMsg('⚡ POWER RUSH ⚡');
    this.sound.playPowerRushStart();

    this._rushBlitzes = 0; // reset blitz counter for clean-rush achievement tracking

    // Auto-open the shop so the player can buy items before the rush begins
    this.state = STATE.SHOP;
    const overlay = document.getElementById('shop-overlay');
    const coinEl  = document.getElementById('shop-coin-count');
    if (coinEl) coinEl.textContent = this.coinsCollected;
    this._updateShopButtons();
    if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('visible'); }

    if (this.debugMode) console.log('[DEBUG] Power Rush entered');
  }

  _exitPowerRush() {
    const doorsScored = this.powerRushDoors;
    const fogPushback = this.powerRushFogBonus;

    this.powerRushActive    = false;
    this.blitzTimer         = 0;
    this.powerRushObstacles = [];
    this.powerRushPickups   = [];
    this.powerRushBigCoins  = [];

    // Reset the next rush trigger to POWER_RUSH_SUBSEQUENT_INTERVAL metres from the EXIT
    // point so that distance traveled during rush doesn't shorten the gap.
    this.nextPowerRushDist = this.distance + POWER_RUSH_SUBSEQUENT_INTERVAL;
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

    // Grant clean-rush achievement if no blitzes occurred and at least one door was scored
    if (this._rushBlitzes === 0 && doorsScored > 0) {
      this._grantAchievement('clean_power_rush');
    }

    // Track cumulative rush/door stats for multi-rush achievements
    this._rushesCompleted++;
    this._totalDoorsScored += doorsScored;
    if (this._rushesCompleted >= 3)       this._grantAchievement('rush_veteran');
    if (this._totalDoorsScored >= 10)     this._grantAchievement('door_master');

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
      case 'magnet':
        this.magnetTimer = 6;  // 6 s of coin attraction
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
      case 'rush_extend': {
        // Extend power rush timer up to the global cap
        const remaining = POWER_RUSH_EXTEND_MAX - this.powerRushExtended;
        if (remaining <= 0) break; // already at cap – pickup has no effect
        const gain = Math.min(2, remaining);
        this.powerRushExtended += gain;
        this.powerRushTimer = Math.max(0, this.powerRushTimer) + gain;
        if (this.powerRushCountdown > 0) {
          this.powerRushCountdown = 0;
          this.powerRushCdTimer   = 0;
        }
        break;
      }
    }
    this._showPickupMsg(PICKUP_CONFIG[type].name);
    if (this.debugMode) console.log(`[DEBUG] Pickup collected: ${type}`);
    // Grant first-pickup achievement
    if (!this._pickupCollected) {
      this._pickupCollected = true;
      this._grantAchievement('power_up');
    }
    // Burst of particles on collection
    for (let i = 0; i < 14; i++) this._spawnParticle(this.marble.x, this.marble.y);
  }

  _showPickupMsg(text) {
    this.pickupMsg = { text, timer: 2.2 };
  }

  // ── Achievement helpers ───────────────────────────────────────────────────

  _loadAchievements() {
    try {
      const raw = localStorage.getItem('mrAchievements');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  _grantAchievement(id) {
    if (this._achievements.has(id)) return; // already unlocked
    this._achievements.add(id);
    try {
      localStorage.setItem('mrAchievements', JSON.stringify([...this._achievements]));
    } catch { /* ignore storage errors */ }
    const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
    if (def) this._showPickupMsg(`🏆 ${def.name}!`);
    this._updateAchievementsBadge();
  }

  _updateAchievementsBadge() {
    const earned = this._achievements.size;
    const total  = ACHIEVEMENT_DEFS.length;
    const achBtn = document.getElementById('achievements-btn');
    if (achBtn) achBtn.textContent = `🏆 ACHIEVEMENTS (${earned}/${total})`;
  }

  // ── Shop ─────────────────────────────────────────────────────────────────

  _initShop() {
    const shopBtn   = document.getElementById('shop-btn');
    const closeBtn  = document.getElementById('shop-close-btn');
    const voidBtn   = document.getElementById('shop-buy-void');
    const magnetBtn = document.getElementById('shop-buy-magnet');
    if (shopBtn)   shopBtn.addEventListener('click',   () => this.openShop());
    if (closeBtn)  closeBtn.addEventListener('click',  () => this.closeShop());
    if (voidBtn)   voidBtn.addEventListener('click',   () => this._buyShopItem('void_push'));
    if (magnetBtn) magnetBtn.addEventListener('click', () => this._buyShopItem('magnet'));
  }

  openShop() {
    // Only open during normal running (manual open via button is blocked during Power Rush or PVP)
    if (this.state !== STATE.RUNNING || this.powerRushActive || this.pvpMode) return;
    this.state = STATE.SHOP;
    const overlay = document.getElementById('shop-overlay');
    const coinEl  = document.getElementById('shop-coin-count');
    if (coinEl) coinEl.textContent = this.coinsCollected;
    this._updateShopButtons();
    if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('visible'); }
  }

  closeShop() {
    if (this.state !== STATE.SHOP) return;
    this.state = STATE.RUNNING;
    const overlay = document.getElementById('shop-overlay');
    if (overlay) { overlay.classList.remove('visible'); overlay.classList.add('hidden'); }
  }

  _updateShopButtons() {
    const voidBtn   = document.getElementById('shop-buy-void');
    const magnetBtn = document.getElementById('shop-buy-magnet');
    if (voidBtn)   voidBtn.disabled   = this.coinsCollected < SHOP_ITEMS.void_push.cost;
    if (magnetBtn) magnetBtn.disabled = this.coinsCollected < SHOP_ITEMS.magnet.cost;
  }

  _buyShopItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item || this.coinsCollected < item.cost) return;
    this.coinsCollected -= item.cost;
    this.ui.updateCoinCount(this.coinsCollected);
    if (itemId === 'void_push') {
      this.fog.y -= 1000;
      this._showPickupMsg('VOID PUSHED BACK!');
    } else if (itemId === 'magnet') {
      this.magnetTimer = 12;
      this._showPickupMsg('MAGNET ACTIVE!');
    }
    // Update shop coin display and button states
    const coinEl = document.getElementById('shop-coin-count');
    if (coinEl) coinEl.textContent = this.coinsCollected;
    this._updateShopButtons();
  }

  // ── Achievements UI ───────────────────────────────────────────────────────

  _initAchievementsUI() {
    const achBtn      = document.getElementById('achievements-btn');
    const achOverlay  = document.getElementById('achievements-overlay');
    const achCloseBtn = document.getElementById('achievements-close-btn');

    const openAch = () => {
      const earned  = this._achievements.size;
      const total   = ACHIEVEMENT_DEFS.length;
      const achTitleEl = achOverlay ? achOverlay.querySelector('.achievements-title') : null;
      if (achTitleEl) achTitleEl.textContent = `🏆 ACHIEVEMENTS (${earned}/${total})`;
      const achList = document.getElementById('achievements-list');
      if (achList) {
        achList.innerHTML = '';
        for (const def of ACHIEVEMENT_DEFS) {
          const unlocked = this._achievements.has(def.id);
          const div = document.createElement('div');
          div.className = `achievement-entry ${unlocked ? 'unlocked' : 'locked'}`;
          div.innerHTML =
            `<span class="ach-icon">${unlocked ? def.icon : '🔒'}</span>` +
            `<div class="ach-info"><div class="ach-name">${def.name}</div>` +
            `<div class="ach-desc">${def.desc}</div></div>` +
            (unlocked ? '<span class="ach-check">✓</span>' : '');
          achList.appendChild(div);
        }
      }
      if (achOverlay) { achOverlay.classList.remove('hidden'); achOverlay.classList.add('visible'); }
    };

    const closeAch = () => {
      if (achOverlay) { achOverlay.classList.remove('visible'); achOverlay.classList.add('hidden'); }
    };

    if (achBtn)      achBtn.addEventListener('click', openAch);
    if (achCloseBtn) achCloseBtn.addEventListener('click', closeAch);
    this._updateAchievementsBadge();
  }

  collectCoin() {
    this.coinsCollected++;
    this.ui.updateCoinCount(this.coinsCollected);
    if (this.coinsCollected >= 10) this._grantAchievement('coin_hoarder');
    if (this.coinsCollected >= 50) this._grantAchievement('treasure_hunter');
    // Small golden particle burst
    for (let i = 0; i < 8; i++) this._spawnParticle(this.marble.x, this.marble.y, '255,215,0');
    this._spawnCoinFloat(this.marble.x, this.marble.y, '+1');
  }

  collectCoins(n) {
    this.coinsCollected += n;
    this.ui.updateCoinCount(this.coinsCollected);
    if (this.coinsCollected >= 10) this._grantAchievement('coin_hoarder');
    if (this.coinsCollected >= 50) this._grantAchievement('treasure_hunter');
    // Particle burst color matches coin type: blue for ×3, red for ×5
    const color = n >= 5 ? '255,80,80' : n >= 3 ? '80,160,255' : '255,215,0';
    for (let i = 0; i < 6 + n * 2; i++) this._spawnParticle(this.marble.x, this.marble.y, color);
    this._spawnCoinFloat(this.marble.x, this.marble.y, `+${n}`);
  }

  // ── Game over ─────────────────────────────────────────────────────────────
  _gameOver() {
    this.state = STATE.DEAD;
    const dist      = this.distance;
    const coinBonus = this.coinsCollected * COIN_VALUE;
    const totalDist = dist + coinBonus;
    const isNew     = totalDist > this.bestDistance;
    if (isNew) {
      this.bestDistance = totalDist;
      localStorage.setItem('mrBestDist', String(totalDist));
    }
    if (this.debugMode) {
      console.log(`[DEBUG] Game over | dist=${dist}m | coins=${this.coinsCollected} | bonus=${coinBonus}m | total=${totalDist}m | best=${this.bestDistance}m | newBest=${isNew}`);
    }
    this.ui.updateBestDistance(this.bestDistance);
    this.ui.showGameOver(dist, totalDist, this.bestDistance, isNew, this.coinsCollected, coinBonus, () => this.restart());
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
      for (const pu of this.powerRushPickups) pu.render(ctx, this.cameraY);
      for (const bc of this.powerRushBigCoins) bc.render(ctx, this.cameraY);
    } else {
      // ── Normal / PVP rendering ───────────────────────────────────────────
      this._renderSynthwaveBg(ctx);
      this._renderStars(ctx);
      this.track.render(ctx, this.cameraY);
      for (const obs of this.obstacles) obs.render(ctx, this.cameraY);
      for (const pu of this.pickups) pu.render(ctx, this.cameraY);
      for (const coin of this.coins) coin.render(ctx, this.cameraY);
      for (const bc of this.blueCoins) bc.render(ctx, this.cameraY);
      for (const rc of this.redCoins) rc.render(ctx, this.cameraY);
      if (!this.pvpMode) this._renderRushLine(ctx);
    }

    // Particles (screen space – always rendered)
    for (const p of this.particles) {
      const sy = p.y - this.cameraY;
      ctx.beginPath();
      ctx.arc(p.x, sy, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color
        ? `rgba(${p.color},${p.life * 0.85})`
        : `rgba(100,200,255,${p.life * 0.8})`;
      ctx.fill();
    }

    // Fog – hidden during Power Rush or PVP (it's paused/absent; don't distract the player)
    if (!this.powerRushActive && !this.pvpMode) {
      this.fog.render(ctx, this.cameraY);
    }

    // Bot marbles (PVP mode – render before player marble so player is on top)
    if (this.pvpMode) {
      for (const bot of this.pvpBots) bot.render(ctx, this.cameraY);
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
    } else if (this.pvpMode && this.state === STATE.RUNNING) {
      // PVP race HUD – progress bar for all racers
      this._renderPvpOverlay(ctx);
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

    // Magnet aura – pulsing pink/purple ring while magnet is active
    if (this.magnetTimer > 0) {
      const msy = this.marble.y - this.cameraY;
      ctx.beginPath();
      ctx.arc(this.marble.x, msy, 160, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,100,255,${0.15 + 0.1 * Math.sin(Date.now() / 200)})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.marble.x, msy, this.marble.radius * 2.3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,80,255,${0.5 + 0.4 * Math.sin(Date.now() / 120)})`;
      ctx.lineWidth   = 3;
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

    // Coin collection floats
    if (this.coinFloats.length > 0) {
      ctx.save();
      ctx.font         = 'bold 15px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      for (const f of this.coinFloats) {
        const alpha = Math.min(f.timer / 0.5, 1);
        const sy    = f.y - this.cameraY;
        ctx.fillStyle = `rgba(255,215,0,${alpha})`;
        ctx.fillText(`${f.text} 💰`, f.x, sy);
      }
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

    // Blitz electric freeze effect
    if (this.blitzTimer > 0) {
      const frac  = this.blitzTimer / POWER_RUSH_BLITZ_DURATION;
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 40);
      // Yellow-white glow around marble
      ctx.beginPath();
      ctx.arc(this.marble.x, this.marble.y, this.marble.radius * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,240,60,${frac * 0.35 * pulse})`;
      ctx.fill();
      // Lightning bolts radiating outward
      ctx.save();
      ctx.translate(this.marble.x, this.marble.y);
      ctx.shadowColor = '#ffe060';
      ctx.shadowBlur  = 14;
      ctx.strokeStyle = `rgba(255,240,80,${frac * pulse})`;
      ctx.lineWidth   = 1.8;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      for (const pts of this._blitzBolts) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
      }
      // Inner bright core
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = `rgba(255,255,200,${frac * 0.9})`;
      ctx.lineWidth   = 0.8;
      for (const pts of this._blitzBolts) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
      }
      ctx.restore();
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

  // ── PVP race HUD overlay ──────────────────────────────────────────────────
  _renderPvpOverlay(ctx) {
    const GOAL = this._pvpGoalDistance;
    ctx.save();

    // Title
    ctx.font         = 'bold 14px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor  = '#ff2200';
    ctx.shadowBlur   = 12;
    ctx.fillStyle    = '#ff6644';
    ctx.fillText(`⚔ RACE TO ${this._pvpGoalDistance.toLocaleString()} m ⚔`, CANVAS_W / 2, 8);
    ctx.shadowBlur   = 0;

    // Progress bars for each racer (player + 3 bots)
    const racers = [
      { name: 'YOU',          dist: this.distance, color: '#4488ee', isPlayer: true },
      ...this.pvpBots.map(b => ({ name: b.name, dist: b.distance, color: `rgb(${b.colors.glow})`, isPlayer: false })),
    ];

    const barX  = 20;
    const barW  = CANVAS_W - 40;
    const barH  = 7;
    const startY = 30;
    const gap    = 13;

    for (let i = 0; i < racers.length; i++) {
      const r    = racers[i];
      const by   = startY + i * (barH + gap);
      const frac = Math.min(r.dist / GOAL, 1);

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(barX, by, barW, barH);

      // Fill
      ctx.fillStyle = r.color;
      ctx.fillRect(barX, by, barW * frac, barH);

      // Border
      ctx.strokeStyle = r.isPlayer ? '#88aaff' : r.color;
      ctx.lineWidth   = 1;
      ctx.strokeRect(barX, by, barW, barH);

      // Label
      ctx.font         = `bold 10px monospace`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = r.isPlayer ? '#ccddff' : '#cccccc';
      ctx.fillText(`${r.name}  ${r.dist}m`, barX + 2, by + barH + 2);
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
      { text: `Magnet:     ${this.magnetTimer.toFixed(2)} s`, color: '#ff88ff' },
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

  // Generate random zigzag lightning bolts radiating from the marble's centre.
  _rebuildBlitzBolts() {
    this._blitzBolts = [];
    const numBolts = 6 + Math.floor(Math.random() * 4);
    const r = this.marble.radius;
    for (let i = 0; i < numBolts; i++) {
      const angle  = (i / numBolts) * Math.PI * 2 + Math.random() * 0.5;
      const length = r * 2.2 + Math.random() * r * 2.5;
      const segs   = 4 + Math.floor(Math.random() * 3);
      const pts    = [];
      for (let s = 0; s <= segs; s++) {
        const t   = s / segs;
        const jit = s > 0 && s < segs ? (Math.random() - 0.5) * r * 1.1 : 0;
        pts.push({
          x: Math.cos(angle) * length * t + Math.sin(angle) * jit,
          y: Math.sin(angle) * length * t - Math.cos(angle) * jit,
        });
      }
      this._blitzBolts.push(pts);
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

  _spawnParticle(x, y, color = null) {
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.6) * 60,
      life: 1,
      size: 2 + Math.random() * 3,
      color,   // if set, used as an RGB string like '255,215,0'
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

  _spawnCoinFloat(x, y, text) {
    this.coinFloats.push({ x, y, text, timer: 1.2 });
  }

  _updateCoinFloats(dt) {
    for (let i = this.coinFloats.length - 1; i >= 0; i--) {
      const f = this.coinFloats[i];
      f.y     -= 40 * dt;  // float upward (world space)
      f.timer -= dt;
      if (f.timer <= 0) this.coinFloats.splice(i, 1);
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
