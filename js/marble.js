// ── Marble ───────────────────────────────────────────────────────────────────

const MARBLE_RADIUS  = 12;
const GRAVITY        = 260;   // px / s²  downward pull (reduced for more controllable feel)
const STEER_FORCE    = 480;   // lateral acceleration from input
const MAX_SPEED_X    = 320;   // horizontal terminal speed
const MAX_SPEED_Y    = 480;   // vertical terminal speed (reduced to give player more reaction time)
const DAMPING_X      = 0.80;  // per-frame horizontal damping (higher damping = marble slows quickly, steering feels crisp)
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

  update(dt, input, track, steerMult = 1) {
    // Steering
    if (input.left)  this.vx -= STEER_FORCE * steerMult * dt;
    if (input.right) this.vx += STEER_FORCE * steerMult * dt;

    // Gravity
    this.vy += GRAVITY * dt;

    // Down boost – extra downward acceleration when held
    if (input.down) this.vy += GRAVITY * 1.5 * dt;

    // Horizontal damping for arcade feel
    this.vx *= Math.pow(DAMPING_X, dt * 60);

    // Clamp speeds
    this.vx = clamp(this.vx, -MAX_SPEED_X, MAX_SPEED_X);
    this.vy = clamp(this.vy, -MAX_SPEED_Y, MAX_SPEED_Y);

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
