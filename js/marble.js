// ── Marble ───────────────────────────────────────────────────────────────────

const MARBLE_RADIUS  = 12;
const GRAVITY        = 260;   // px / s²  downward pull (reduced for more controllable feel)
const STEER_FORCE    = 800;   // lateral acceleration from input
const MAX_SPEED_X    = 500;   // horizontal terminal speed
const MAX_SPEED_Y    = 480;   // vertical terminal speed (reduced to give player more reaction time)
const DAMPING_X      = 0.88;  // per-frame velocity retention (closer to 1.0 = less resistance, steering has more impact)
const BOUNCE_FACTOR  = 0.35;  // energy kept on wall bounce
const TRAIL_MAX      = 22;

class Marble {
  constructor(x, y) {
    this.radius = MARBLE_RADIUS;
    this.reset(x, y);
  }

  reset(x, y) {
    this.x  = x;
    this.y  = y;
    this.vx = 0;
    this.vy = 0;
    this.trail = [];
    this.onGround = false;
    this.shakeTimer = 0;
  }

  update(dt, input, track, steerMult = 1, gravityMult = 1) {
    // Steering
    if (input.left)  this.vx -= STEER_FORCE * steerMult * dt;
    if (input.right) this.vx += STEER_FORCE * steerMult * dt;

    // Gravity
    this.vy += GRAVITY * gravityMult * dt;

    // Down boost – extra downward acceleration when held
    if (input.down) this.vy += GRAVITY * gravityMult * 1.5 * dt;

    // Up brake – slow downward velocity when held
    if (input.up && this.vy > 0) this.vy = Math.max(0, this.vy - GRAVITY * gravityMult * 2 * dt);

    // Horizontal damping for arcade feel
    this.vx *= Math.pow(DAMPING_X, dt * 60);

    // Clamp speeds – vertical cap scales with gravityMult so the top gathered
    // falling speed is proportional to the fall-speed slider setting.
    this.vx = clamp(this.vx, -MAX_SPEED_X * steerMult, MAX_SPEED_X * steerMult);
    this.vy = clamp(this.vy, -MAX_SPEED_Y * gravityMult, MAX_SPEED_Y * gravityMult);

    // Move
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Track collision
    track.resolveCollision(this);

    // Trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > TRAIL_MAX) this.trail.shift();

    // Shake timer
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
  }

  triggerShake() {
    this.shakeTimer = 0.18;
  }

  get speed() {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }
}
