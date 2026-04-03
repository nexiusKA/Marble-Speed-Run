// ── Track ────────────────────────────────────────────────────────────────────
// The track is described as a series of segments.  Each segment has a
// left-wall polyline and a right-wall polyline rendered and used for
// collision.  We also store checkpoint Y values and the finish-line Y.
//
// World coordinates:  canvas width = 480, canvas height = 700 (logical).
// The camera scrolls vertically so the marble stays in the upper-third.

const CANVAS_W = 480;
const CANVAS_H = 700;

// ── Level data ───────────────────────────────────────────────────────────────
// Each segment: { leftX, rightX, y }  — defines left/right wall x at that y.
// The track is linearly interpolated between knots.

const TRACK_KNOTS = [
  // y,   leftX, rightX
  [    0,   160,   320 ],  // start – moderate width
  [  200,   140,   340 ],  // slight widen
  [  380,   180,   300 ],  // narrows
  [  520,   100,   380 ],  // widens fast (boost section)
  [  680,   170,   310 ],  // narrows again
  [  900,   130,   350 ],
  [ 1050,   200,   280 ],  // very narrow!
  [ 1200,   100,   380 ],
  [ 1350,   160,   320 ],
  [ 1550,    90,   390 ],  // wide for gap zone
  [ 1700,   160,   320 ],
  [ 1900,   140,   340 ],
  [ 2000,   180,   300 ],
  [ 2200,   100,   380 ],
  [ 2400,   160,   320 ],  // finish approach
  [ 2600,   150,   330 ],  // finish line at y≈2500
];

// World height of the level
const LEVEL_HEIGHT  = 2600;
const FINISH_Y      = 2490;
const START_X       = 240;
const START_Y       = 60;

// ── Checkpoints (world Y) – marble resets to nearest passed checkpoint
const CHECKPOINTS = [400, 900, 1400, 1900];

// ── Helper: get left/right wall X at a given world Y by interpolating knots
function getWallsAtY(worldY) {
  const knots = TRACK_KNOTS;
  if (worldY <= knots[0][0]) {
    return { left: knots[0][1], right: knots[0][2] };
  }
  if (worldY >= knots[knots.length - 1][0]) {
    const last = knots[knots.length - 1];
    return { left: last[1], right: last[2] };
  }
  for (let i = 0; i < knots.length - 1; i++) {
    const [y0, l0, r0] = knots[i];
    const [y1, l1, r1] = knots[i + 1];
    if (worldY >= y0 && worldY <= y1) {
      const t = (worldY - y0) / (y1 - y0);
      return {
        left:  lerp(l0, l1, t),
        right: lerp(r0, r1, t),
      };
    }
  }
  return { left: 160, right: 320 };
}

// ── Track class ───────────────────────────────────────────────────────────────
class Track {
  constructor() {
    this.finishY     = FINISH_Y;
    this.startX      = START_X;
    this.startY      = START_Y;
    this.checkpoints = CHECKPOINTS;
  }

  // Returns the world-Y of the last checkpoint the marble has passed
  getCheckpointY(marbleWorldY) {
    let best = this.startY;
    for (const cpY of this.checkpoints) {
      if (marbleWorldY > cpY) best = cpY;
    }
    return best;
  }

  // Returns the marble's spawn X at a given checkpoint Y
  getCheckpointX(cpY) {
    if (cpY === this.startY) return this.startX;
    const { left, right } = getWallsAtY(cpY);
    return (left + right) / 2;
  }

  // Push marble out of walls
  resolveCollision(marble) {
    const { left, right } = getWallsAtY(marble.y);
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

  // Check if marble fell off the bottom of the level (shouldn't happen normally)
  isOutOfBounds(marble) {
    return marble.y > LEVEL_HEIGHT + 100;
  }

  hasFinished(marble) {
    return marble.y >= this.finishY;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  render(ctx, cameraY) {
    // Only draw visible range (add margin)
    const visTop    = cameraY - 50;
    const visBottom = cameraY + CANVAS_H + 50;
    const step      = 6; // px per slice

    // Build left/right polylines for the visible portion
    const leftPts  = [];
    const rightPts = [];

    for (let wy = visTop; wy <= visBottom; wy += step) {
      const { left, right } = getWallsAtY(wy);
      const sy = wy - cameraY; // screen Y
      leftPts.push( [left,  sy]);
      rightPts.push([right, sy]);
    }

    // Fill track interior
    ctx.beginPath();
    ctx.moveTo(leftPts[0][0], leftPts[0][1]);
    for (const [x, y] of leftPts)  ctx.lineTo(x, y);
    for (let i = rightPts.length - 1; i >= 0; i--) {
      ctx.lineTo(rightPts[i][0], rightPts[i][1]);
    }
    ctx.closePath();

    // Track gradient (top=blue-grey, bottom=darker)
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0,   '#1e2240');
    grad.addColorStop(1,   '#151830');
    ctx.fillStyle = grad;
    ctx.fill();

    // Track edge lines
    ctx.lineWidth = 3;
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
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(100,120,220,0.25)';
    ctx.beginPath();
    for (let wy = visTop; wy <= visBottom; wy += step) {
      const { left, right } = getWallsAtY(wy);
      const cx = (left + right) / 2;
      const sy = wy - cameraY;
      if (wy === visTop) ctx.moveTo(cx, sy);
      else               ctx.lineTo(cx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Narrow-section warning tint (track width < 110 px)
    for (let wy = visTop; wy <= visBottom; wy += step * 2) {
      const { left, right } = getWallsAtY(wy);
      if (right - left < 115) {
        const sy = wy - cameraY;
        ctx.fillStyle = 'rgba(255,80,80,0.05)';
        ctx.fillRect(left, sy, right - left, step * 2);
      }
    }

    // Boost zone tint (wide sections, track width > 240)
    for (let wy = visTop; wy <= visBottom; wy += step * 2) {
      const { left, right } = getWallsAtY(wy);
      if (right - left > 240) {
        const sy = wy - cameraY;
        ctx.fillStyle = 'rgba(80,255,180,0.04)';
        ctx.fillRect(left, sy, right - left, step * 2);
      }
    }

    // Checkpoints
    for (const cpY of CHECKPOINTS) {
      const sy = cpY - cameraY;
      if (sy < -20 || sy > CANVAS_H + 20) continue;
      const { left, right } = getWallsAtY(cpY);
      ctx.strokeStyle = 'rgba(100,200,100,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(left, sy);
      ctx.lineTo(right, sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Finish line
    const fsy = this.finishY - cameraY;
    if (fsy >= -20 && fsy <= CANVAS_H + 20) {
      const { left: fl, right: fr } = getWallsAtY(this.finishY);
      // Checkerboard
      const tileW = 16, tileH = 12;
      const cols  = Math.ceil((fr - fl) / tileW);
      const rows  = 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const isWhite = (row + col) % 2 === 0;
          ctx.fillStyle = isWhite ? '#ffffff' : '#000000';
          ctx.fillRect(
            fl + col * tileW,
            fsy - tileH + row * tileH,
            tileW, tileH
          );
        }
      }
      ctx.strokeStyle = '#ffee44';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(fl, fsy);
      ctx.lineTo(fr, fsy);
      ctx.stroke();
    }

    // Start banner
    const ssY = this.startY - cameraY;
    if (ssY >= -20 && ssY <= CANVAS_H + 20) {
      const { left: sl, right: sr } = getWallsAtY(this.startY);
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
