// ── Track ────────────────────────────────────────────────────────────────────
// Endless procedurally generated track.  Wall positions are defined by a
// rolling list of knots [worldY, leftX, rightX] interpolated linearly.
//
// World coordinates: canvas width = 480, canvas height = 700 (logical).
// The camera scrolls vertically so the marble stays near the upper-third.

const CANVAS_W = 480;
const CANVAS_H = 700;

const START_X = 240;
const START_Y = 60;

// How far ahead to keep knots generated (world units)
const TRACK_LOOKAHEAD   = 2500;
// Spacing between generated knots
const KNOT_SPACING_MIN  = 280;
const KNOT_SPACING_MAX  = 480;

// ── Track class ───────────────────────────────────────────────────────────────
class Track {
  constructor() {
    this.startX = START_X;
    this.startY = START_Y;

    // Seed knots that match the opening stretch
    this.knots = [
      [   0, 160, 320],
      [ 200, 140, 340],
      [ 480, 165, 315],
    ];

    // Drift state for procedural generation
    this._centerX = 240;

    // Pre-generate enough track to fill the initial view
    this.extend(START_Y + TRACK_LOOKAHEAD);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  // Ensure knots exist at least up to upToWorldY
  extend(upToWorldY) {
    while (this.knots[this.knots.length - 1][0] < upToWorldY) {
      this._addKnot();
    }
  }

  // Remove knots that are far behind the camera (memory management)
  prune(behindWorldY) {
    while (this.knots.length > 3 && this.knots[1][0] < behindWorldY) {
      this.knots.shift();
    }
  }

  // Interpolate wall positions at the given world Y
  getWallsAtY(worldY) {
    const knots = this.knots;
    if (worldY <= knots[0][0]) {
      return { left: knots[0][1], right: knots[0][2] };
    }
    const last = knots[knots.length - 1];
    if (worldY >= last[0]) {
      return { left: last[1], right: last[2] };
    }
    for (let i = 0; i < knots.length - 1; i++) {
      const [y0, l0, r0] = knots[i];
      const [y1, l1, r1] = knots[i + 1];
      if (worldY >= y0 && worldY <= y1) {
        const t = (worldY - y0) / (y1 - y0);
        return { left: lerp(l0, l1, t), right: lerp(r0, r1, t) };
      }
    }
    return { left: 160, right: 320 };
  }

  // Push marble out of walls on horizontal collision
  resolveCollision(marble) {
    const { left, right } = this.getWallsAtY(marble.y);
    const innerLeft  = left  + marble.radius;
    const innerRight = right - marble.radius;

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

  // Endless mode – no out-of-bounds or finish conditions
  isOutOfBounds(_marble) { return false; }
  hasFinished(_marble)   { return false; }

  // ── Procedural generation ──────────────────────────────────────────────────
  _addKnot() {
    const last       = this.knots[this.knots.length - 1];
    const lastY      = last[0];
    const difficulty = Math.min(lastY / 12000, 1); // 0 → 1 over 12 000 px

    const spacing = KNOT_SPACING_MIN + Math.random() * (KNOT_SPACING_MAX - KNOT_SPACING_MIN);
    const newY    = lastY + spacing;

    // Gently drift the centre X
    const drift   = (Math.random() - 0.5) * 64;
    this._centerX = clamp(this._centerX + drift, 155, 325);

    // Track half-width narrows with difficulty (160→95 px half-width → full 320→190 px)
    const baseHalf = lerp(160, 95, difficulty);
    const halfW    = Math.max(48, baseHalf + (Math.random() - 0.5) * 40);

    const leftX  = clamp(this._centerX - halfW, 72, 210);
    const rightX = clamp(this._centerX + halfW, 270, 408);

    this.knots.push([newY, leftX, rightX]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  render(ctx, cameraY) {
    const visTop    = cameraY - 50;
    const visBottom = cameraY + CANVAS_H + 50;
    const step      = 6;

    const leftPts  = [];
    const rightPts = [];

    for (let wy = visTop; wy <= visBottom; wy += step) {
      const { left, right } = this.getWallsAtY(wy);
      const sy = wy - cameraY;
      leftPts.push( [left,  sy]);
      rightPts.push([right, sy]);
    }

    // Track fill
    ctx.beginPath();
    ctx.moveTo(leftPts[0][0], leftPts[0][1]);
    for (const [x, y] of leftPts)  ctx.lineTo(x, y);
    for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i][0], rightPts[i][1]);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1e2240');
    grad.addColorStop(1, '#151830');
    ctx.fillStyle = grad;
    ctx.fill();

    // Edge lines
    ctx.lineWidth   = 3;
    ctx.strokeStyle = '#5566cc';
    ctx.beginPath();
    ctx.moveTo(leftPts[0][0], leftPts[0][1]);
    for (const [x, y] of leftPts) ctx.lineTo(x, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightPts[0][0], rightPts[0][1]);
    for (const [x, y] of rightPts) ctx.lineTo(x, y);
    ctx.stroke();

    // Centre dashed line (speed feel)
    ctx.setLineDash([14, 10]);
    ctx.lineWidth   = 1;
    ctx.strokeStyle = 'rgba(100,120,220,0.25)';
    ctx.beginPath();
    for (let wy = visTop; wy <= visBottom; wy += step) {
      const { left, right } = this.getWallsAtY(wy);
      const cx = (left + right) / 2;
      const sy = wy - cameraY;
      if (wy === visTop) ctx.moveTo(cx, sy);
      else               ctx.lineTo(cx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Narrow-section warning tint
    for (let wy = visTop; wy <= visBottom; wy += step * 2) {
      const { left, right } = this.getWallsAtY(wy);
      if (right - left < 115) {
        const sy = wy - cameraY;
        ctx.fillStyle = 'rgba(255,80,80,0.05)';
        ctx.fillRect(left, sy, right - left, step * 2);
      }
    }

    // Wide-section (boost zone) tint
    for (let wy = visTop; wy <= visBottom; wy += step * 2) {
      const { left, right } = this.getWallsAtY(wy);
      if (right - left > 220) {
        const sy = wy - cameraY;
        ctx.fillStyle = 'rgba(80,255,180,0.04)';
        ctx.fillRect(left, sy, right - left, step * 2);
      }
    }

    // Start banner
    const ssY = this.startY - cameraY;
    if (ssY >= -20 && ssY <= CANVAS_H + 20) {
      const { left: sl, right: sr } = this.getWallsAtY(this.startY);
      ctx.strokeStyle = '#44ffaa';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(sl, ssY);
      ctx.lineTo(sr, ssY);
      ctx.stroke();
      ctx.fillStyle = 'rgba(68,255,170,0.15)';
      ctx.fillRect(sl, ssY, sr - sl, 12);
    }
  }
}
