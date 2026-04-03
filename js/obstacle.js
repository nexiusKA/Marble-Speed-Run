// ── Obstacles ────────────────────────────────────────────────────────────────
// Three obstacle types:
//   1. RotatingBar   – a bar that spins around a pivot
//   2. MovingBlocker – slides left/right across the track
//   3. BoostPad      – gives the marble a speed boost downward

class RotatingBar {
  constructor(cx, worldY, halfLen, speed) {
    this.cx      = cx;       // pivot X (world)
    this.worldY  = worldY;   // pivot Y (world)
    this.halfLen = halfLen;  // half-length of the bar
    this.speed   = speed;    // radians per second
    this.angle   = Math.random() * Math.PI * 2;
    this.w       = 8;        // bar width for collision
  }

  update(dt) {
    this.angle += this.speed * dt;
  }

  // Returns the two endpoints in world coords
  endpoints() {
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    return {
      ax: this.cx - cos * this.halfLen,
      ay: this.worldY - sin * this.halfLen,
      bx: this.cx + cos * this.halfLen,
      by: this.worldY + sin * this.halfLen,
    };
  }

  checkCollision(marble) {
    const { ax, ay, bx, by } = this.endpoints();
    const hit = circleSegmentCollision(marble.x, marble.y, marble.radius, ax, ay, bx, by);
    if (!hit) return false;
    // Push marble out
    marble.x += hit.nx * hit.depth;
    marble.y += hit.ny * hit.depth;
    // Reflect velocity
    const dot = marble.vx * hit.nx + marble.vy * hit.ny;
    marble.vx = (marble.vx - 2 * dot * hit.nx) * 0.5;
    marble.vy = (marble.vy - 2 * dot * hit.ny) * 0.5;
    marble.triggerShake();
    return true;
  }

  render(ctx, cameraY) {
    const { ax, ay, bx, by } = this.endpoints();
    const sx = this.cx, sy = this.worldY - cameraY;
    const sax = ax, say = ay - cameraY;
    const sbx = bx, sby = by - cameraY;

    // Bar shadow
    ctx.lineWidth   = this.w + 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(sax + 2, say + 2);
    ctx.lineTo(sbx + 2, sby + 2);
    ctx.stroke();

    // Bar body
    ctx.lineWidth   = this.w;
    ctx.strokeStyle = '#dd4422';
    ctx.beginPath();
    ctx.moveTo(sax, say);
    ctx.lineTo(sbx, sby);
    ctx.stroke();

    // Highlight
    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#ff8866';
    ctx.beginPath();
    ctx.moveTo(sax, say);
    ctx.lineTo(sbx, sby);
    ctx.stroke();

    // Pivot
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle   = '#ffcc44';
    ctx.fill();
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = '#cc8800';
    ctx.stroke();
  }
}

// ── MovingBlocker ─────────────────────────────────────────────────────────────
class MovingBlocker {
  constructor(worldY, minX, maxX, speed, w, h) {
    this.worldY = worldY;
    this.minX   = minX;
    this.maxX   = maxX;
    this.speed  = speed;
    this.w      = w || 50;
    this.h      = h || 16;
    this.x      = (minX + maxX) / 2;
    this.dir    = 1;
  }

  update(dt) {
    this.x += this.speed * this.dir * dt;
    if (this.x + this.w / 2 >= this.maxX) { this.x = this.maxX - this.w / 2; this.dir = -1; }
    if (this.x - this.w / 2 <= this.minX) { this.x = this.minX + this.w / 2; this.dir =  1; }
  }

  checkCollision(marble) {
    const rx = this.x - this.w / 2;
    const ry = this.worldY - this.h / 2;
    const hit = circleRectCollision(marble.x, marble.y, marble.radius, rx, ry, this.w, this.h);
    if (!hit) return false;
    marble.x += hit.nx * hit.depth;
    marble.y += hit.ny * hit.depth;
    const dot = marble.vx * hit.nx + marble.vy * hit.ny;
    marble.vx = (marble.vx - 2 * dot * hit.nx) * 0.45;
    marble.vy = (marble.vy - 2 * dot * hit.ny) * 0.45;
    marble.triggerShake();
    return true;
  }

  render(ctx, cameraY) {
    const sx = this.x - this.w / 2;
    const sy = this.worldY - this.h / 2 - cameraY;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx + 3, sy + 4, this.w, this.h);

    // Body
    const grad = ctx.createLinearGradient(sx, sy, sx, sy + this.h);
    grad.addColorStop(0, '#ee8800');
    grad.addColorStop(1, '#aa4400');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(sx, sy, this.w, this.h, 4);
    ctx.fill();

    // Highlight stripe
    ctx.fillStyle = 'rgba(255,255,200,0.25)';
    ctx.fillRect(sx + 4, sy + 2, this.w - 8, 4);

    // Border
    ctx.strokeStyle = '#ffaa22';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(sx, sy, this.w, this.h, 4);
    ctx.stroke();
  }
}

// ── BoostPad ─────────────────────────────────────────────────────────────────
class BoostPad {
  constructor(cx, worldY, trackWidth) {
    this.cx         = cx;
    this.worldY     = worldY;
    this.w          = Math.min(trackWidth * 0.55, 90);
    this.h          = 14;
    this.boostForce = 320;   // added to vy (downward)
    this.pulse      = 0;     // animation timer
  }

  update(dt) {
    this.pulse = (this.pulse + dt * 3) % (Math.PI * 2);
  }

  checkCollision(marble) {
    const rx = this.cx - this.w / 2;
    const ry = this.worldY - this.h / 2;
    const hit = circleRectCollision(marble.x, marble.y, marble.radius, rx, ry, this.w, this.h);
    if (!hit) return false;
    if (hit.ny < 0) {
      // marble is above the pad (coming down onto it)
      marble.vy += this.boostForce;
    }
    return true;
  }

  render(ctx, cameraY) {
    const sx  = this.cx - this.w / 2;
    const sy  = this.worldY - this.h / 2 - cameraY;
    const glow = 0.5 + 0.5 * Math.sin(this.pulse);

    ctx.shadowColor = `rgba(0,255,150,${glow * 0.8})`;
    ctx.shadowBlur  = 14;

    const grad = ctx.createLinearGradient(sx, sy, sx, sy + this.h);
    grad.addColorStop(0, `rgba(0,255,150,${0.7 + glow * 0.3})`);
    grad.addColorStop(1, `rgba(0,160,80,${0.5 + glow * 0.3})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(sx, sy, this.w, this.h, 5);
    ctx.fill();

    // Arrow indicators
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255,255,255,0.7)';
    const arrowX = this.cx, arrowY = sy + this.h / 2;
    for (let i = -1; i <= 1; i++) {
      const ax = arrowX + i * (this.w / 4);
      ctx.beginPath();
      ctx.moveTo(ax - 4, arrowY - 2);
      ctx.lineTo(ax,     arrowY + 3);
      ctx.lineTo(ax + 4, arrowY - 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

// ── Factory: build the level's obstacle set ───────────────────────────────────
function buildObstacles() {
  return [
    // Rotating bars
    new RotatingBar(240, 280, 52, 1.8),
    new RotatingBar(230, 650, 48, -2.2),
    new RotatingBar(255, 1000, 44, 2.5),
    new RotatingBar(230, 1300, 50, -1.6),
    new RotatingBar(245, 1700, 46,  2.0),
    new RotatingBar(235, 2100, 50, -2.4),
    new RotatingBar(240, 2350, 44,  1.9),

    // Moving blockers
    new MovingBlocker( 460,  155,  325, 140, 54, 14),
    new MovingBlocker( 760,  115,  365, 110, 54, 14),
    new MovingBlocker(1150,  155,  275, 160, 50, 14),
    new MovingBlocker(1600,  115,  365, 130, 54, 14),
    new MovingBlocker(2050,  120,  360, 150, 50, 14),
    new MovingBlocker(2300,  145,  335, 170, 48, 14),

    // Boost pads
    new BoostPad(240, 530,  240),
    new BoostPad(240, 1250, 280),
    new BoostPad(240, 1900, 200),
  ];
}
