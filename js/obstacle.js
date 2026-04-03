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

// ── WallBlocker ───────────────────────────────────────────────────────────────
// A solid ledge that juts inward from the left or right track wall, forcing the
// player to steer away from the edge rather than hugging it the whole way down.
// Supports three shapes: 'rect', 'wedge' (triangle tip), and 'step' (two-tier ledge).
class WallBlocker {
  constructor(worldY, side, wallX, protrude, h, shape) {
    this.worldY  = worldY;
    this.side    = side;       // 'left' | 'right'
    this.h       = h || 20;
    this.shape   = shape || 'rect'; // 'rect' | 'wedge' | 'step'
    this.protrude = protrude;  // how far into the track (px)

    if (side === 'left') {
      this.rx = wallX;                  // rect left edge  = wall
      this.w  = protrude;
    } else {
      this.rx = wallX - protrude;       // rect left edge  = wall - protrude
      this.w  = protrude;
    }
  }

  update(_dt) {}

  checkCollision(marble) {
    const ry  = this.worldY - this.h / 2;
    const hit = circleRectCollision(marble.x, marble.y, marble.radius, this.rx, ry, this.w, this.h);
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
    const sx = this.rx;
    const sy = this.worldY - this.h / 2 - cameraY;

    if (this.shape === 'wedge') {
      this._renderWedge(ctx, sx, sy);
    } else if (this.shape === 'step') {
      this._renderStep(ctx, sx, sy);
    } else {
      this._renderRect(ctx, sx, sy);
    }
  }

  _renderRect(ctx, sx, sy) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(sx + 3, sy + 4, this.w, this.h);

    // Body gradient (stone-grey)
    const grad = ctx.createLinearGradient(sx, sy, sx, sy + this.h);
    grad.addColorStop(0, '#7a8090');
    grad.addColorStop(1, '#3a404c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(sx, sy, this.w, this.h, 3);
    ctx.fill();

    // Highlight stripe
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(sx + 3, sy + 3, this.w - 6, Math.max(1, Math.min(5, this.h - 6)));

    // Border
    ctx.strokeStyle = '#9aa0b0';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(sx, sy, this.w, this.h, 3);
    ctx.stroke();

    // Warning stripe on the inner tip
    const tipW = 8;
    const tipX = this.side === 'left' ? sx + this.w - tipW : sx;
    ctx.fillStyle = 'rgba(255,80,80,0.55)';
    ctx.fillRect(tipX, sy, tipW, this.h);
  }

  _renderWedge(ctx, sx, sy) {
    // Triangle wedge pointing inward (tip toward the center of the track)
    const isLeft = this.side === 'left';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    if (isLeft) {
      ctx.moveTo(sx + 3, sy + 4);
      ctx.lineTo(sx + this.w + 3, sy + this.h / 2 + 4);
      ctx.lineTo(sx + 3, sy + this.h + 4);
    } else {
      ctx.moveTo(sx + this.w + 3, sy + 4);
      ctx.lineTo(sx + 3, sy + this.h / 2 + 4);
      ctx.lineTo(sx + this.w + 3, sy + this.h + 4);
    }
    ctx.closePath();
    ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(sx, sy, sx + this.w, sy);
    grad.addColorStop(0, isLeft ? '#5a6070' : '#8a9090');
    grad.addColorStop(1, isLeft ? '#8a9090' : '#5a6070');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (isLeft) {
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + this.w, sy + this.h / 2);
      ctx.lineTo(sx, sy + this.h);
    } else {
      ctx.moveTo(sx + this.w, sy);
      ctx.lineTo(sx, sy + this.h / 2);
      ctx.lineTo(sx + this.w, sy + this.h);
    }
    ctx.closePath();
    ctx.fill();

    // Border + tip highlight
    ctx.strokeStyle = '#9aa0b0';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    if (isLeft) {
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + this.w, sy + this.h / 2);
      ctx.lineTo(sx, sy + this.h);
    } else {
      ctx.moveTo(sx + this.w, sy);
      ctx.lineTo(sx, sy + this.h / 2);
      ctx.lineTo(sx + this.w, sy + this.h);
    }
    ctx.closePath();
    ctx.stroke();

    // Red tip dot
    const tipX = isLeft ? sx + this.w : sx;
    const tipY = sy + this.h / 2;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,80,80,0.8)';
    ctx.fill();
  }

  _renderStep(ctx, sx, sy) {
    // Two-tier stepped ledge: a taller thick base + a narrower front step
    const stepFrac = 0.55; // front step is 55% of total protrude
    const isLeft   = this.side === 'left';
    const baseW    = this.w;
    const stepW    = Math.round(this.w * stepFrac);
    const baseH    = this.h;
    const stepH    = Math.round(this.h * 0.55);

    // Positions: base always flush to wall; step protrudes further
    const baseSx = sx;
    const stepSx = isLeft ? sx + (baseW - stepW) : sx;
    const stepSy = sy + (baseH - stepH) / 2; // vertically centred on the base

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(baseSx + 3, sy + 4, baseW, baseH);

    // Base body
    const gradBase = ctx.createLinearGradient(baseSx, sy, baseSx, sy + baseH);
    gradBase.addColorStop(0, '#5a6070');
    gradBase.addColorStop(1, '#2e333d');
    ctx.fillStyle = gradBase;
    ctx.beginPath();
    ctx.roundRect(baseSx, sy, baseW, baseH, 3);
    ctx.fill();

    // Front step body
    const gradStep = ctx.createLinearGradient(stepSx, stepSy, stepSx, stepSy + stepH);
    gradStep.addColorStop(0, '#7a8090');
    gradStep.addColorStop(1, '#4a505c');
    ctx.fillStyle = gradStep;
    ctx.beginPath();
    ctx.roundRect(stepSx, stepSy, stepW, stepH, 3);
    ctx.fill();

    // Highlight on step
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(stepSx + 3, stepSy + 3, stepW - 6, Math.max(1, Math.min(4, stepH - 6)));

    // Borders
    ctx.strokeStyle = '#9aa0b0';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(baseSx, sy, baseW, baseH, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(stepSx, stepSy, stepW, stepH, 3);
    ctx.stroke();

    // Red warning tip
    const tipW = 7;
    const tipX = isLeft ? stepSx + stepW - tipW : stepSx;
    ctx.fillStyle = 'rgba(255,80,80,0.6)';
    ctx.fillRect(tipX, stepSy, tipW, stepH);
  }
}

// ── Dynamic obstacle generator ────────────────────────────────────────────────
// Builds a list of obstacles for a given vertical world-space range.
// difficulty: 0 (easy) → 1 (hard)
// track: Track instance used to query wall positions
function buildObstaclesForRange(fromY, toY, difficulty, track) {
  const obs = [];

  // Number of obstacles scales with difficulty (1..4 per segment)
  const count  = 1 + Math.floor(difficulty * 3 + Math.random() * 1.5);
  const segH   = (toY - fromY) / count;

  for (let i = 0; i < count; i++) {
    // Stagger within the sub-segment so obstacles don't cluster
    const y = fromY + segH * (i + 0.2 + Math.random() * 0.6);
    const { left, right } = track.getWallsAtY(y);
    const width = right - left;
    const cx    = (left + right) / 2;

    const rand = Math.random();
    if (rand < 0.30) {
      // Rotating bar – length limited to track width
      const halfLen = Math.min(38 + Math.random() * 24, width * 0.42);
      const spd     = (1.4 + difficulty * 1.8) * (Math.random() < 0.5 ? 1 : -1);
      obs.push(new RotatingBar(cx, y, halfLen, spd));
    } else if (rand < 0.58) {
      // Moving blocker
      const blkW   = 42 + Math.random() * 22;
      const margin = 10;
      const spd    = 90 + Math.random() * (80 + difficulty * 80);
      obs.push(new MovingBlocker(y, left + margin, right - margin, spd, blkW, 14));
    } else if (rand < 0.83) {
      // Wall blocker – juts inward from left or right wall
      const side     = Math.random() < 0.5 ? 'left' : 'right';
      const maxProtrude = Math.max(50, width * 0.55);
      const protrude = 50 + Math.random() * Math.max(0, Math.min(55, maxProtrude - 50));
      const wallX    = side === 'left' ? left : right;
      const h        = 10 + Math.random() * 34;   // height 10–44 px
      const shapes   = ['rect', 'wedge', 'step'];
      const shape    = shapes[Math.floor(Math.random() * shapes.length)];
      obs.push(new WallBlocker(y, side, wallX, protrude, h, shape));
    } else {
      // Boost pad (reward, not hazard)
      obs.push(new BoostPad(cx, y, width));
    }
  }

  return obs;
}
