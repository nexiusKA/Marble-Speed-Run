// ── Obstacles ────────────────────────────────────────────────────────────────
// Obstacle types:
//   1. RotatingBar    – a bar that spins around a pivot (random colour & position)
//   2. MovingBlocker  – slides left/right across the track
//   3. BoostPad       – gives the marble a speed boost downward
//   4. WallBlocker    – diagonal bar from the wall
//   5. ElectricSpinner– multi-arm spinning obstacle crackling with electricity
//   6. DoorGate       – three doors spanning the track; one open (green), two blocked (red)

// Colour palettes for rotating bars [body, highlight, pivotFill, pivotStroke]
const BAR_STYLES = [
  ['#dd4422', '#ff8866', '#ffcc44', '#cc8800'],  // red
  ['#22aadd', '#66ccff', '#44ccff', '#008899'],  // blue
  ['#22dd44', '#66ff88', '#44ff88', '#008822'],  // green
  ['#ddaa22', '#ffcc66', '#ffee44', '#aa7700'],  // gold
  ['#cc22dd', '#ee66ff', '#dd44ff', '#880088'],  // violet
  ['#dd6622', '#ffaa55', '#ffcc88', '#aa4400'],  // orange
];

class RotatingBar {
  constructor(cx, worldY, halfLen, speed) {
    this.cx      = cx;       // pivot X (world)
    this.worldY  = worldY;   // pivot Y (world)
    this.halfLen = halfLen;  // half-length of the bar
    this.speed   = speed;    // radians per second
    this.angle   = Math.random() * Math.PI * 2;
    this.w       = 8;        // bar width for collision
    this.style   = BAR_STYLES[Math.floor(Math.random() * BAR_STYLES.length)];
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
    const [body, highlight, pivotFill, pivotStroke] = this.style;

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
    ctx.strokeStyle = body;
    ctx.beginPath();
    ctx.moveTo(sax, say);
    ctx.lineTo(sbx, sby);
    ctx.stroke();

    // Highlight
    ctx.lineWidth   = 2;
    ctx.strokeStyle = highlight;
    ctx.beginPath();
    ctx.moveTo(sax, say);
    ctx.lineTo(sbx, sby);
    ctx.stroke();

    // Pivot
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle   = pivotFill;
    ctx.fill();
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = pivotStroke;
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

// ── ElectricSpinner ───────────────────────────────────────────────────────────
// A multi-arm spinning obstacle crackling with electricity.
class ElectricSpinner {
  constructor(cx, worldY, halfLen, speed, numArms) {
    this.cx      = cx;
    this.worldY  = worldY;
    this.halfLen = halfLen;
    this.speed   = speed;
    this.angle   = Math.random() * Math.PI * 2;
    this.numArms = (numArms && numArms > 0) ? numArms : (2 + Math.floor(Math.random() * 3)); // 2–4 arms
    this.w       = 7;
    this.pulse   = Math.random() * Math.PI * 2;
    this._jitter = Array.from({ length: 14 }, () => Math.random() - 0.5);
  }

  update(dt) {
    this.angle += this.speed * dt;
    this.pulse  = (this.pulse + dt * 10) % (Math.PI * 2);
    // Randomly refresh jitter offsets to make electricity crackle
    if (Math.random() < dt * 14) {
      this._jitter = Array.from({ length: 14 }, () => Math.random() - 0.5);
    }
  }

  _armEndpoints() {
    const arms = [];
    const step = (Math.PI * 2) / this.numArms;
    for (let i = 0; i < this.numArms; i++) {
      const a   = this.angle + step * i;
      const cos = Math.cos(a), sin = Math.sin(a);
      arms.push({
        ax: this.cx - cos * this.halfLen,
        ay: this.worldY - sin * this.halfLen,
        bx: this.cx + cos * this.halfLen,
        by: this.worldY + sin * this.halfLen,
      });
    }
    return arms;
  }

  checkCollision(marble) {
    const arms = this._armEndpoints();
    for (const arm of arms) {
      const hit = circleSegmentCollision(marble.x, marble.y, marble.radius,
                                         arm.ax, arm.ay, arm.bx, arm.by);
      if (hit) {
        marble.x += hit.nx * hit.depth;
        marble.y += hit.ny * hit.depth;
        const dot = marble.vx * hit.nx + marble.vy * hit.ny;
        marble.vx = (marble.vx - 2 * dot * hit.nx) * 0.45;
        marble.vy = (marble.vy - 2 * dot * hit.ny) * 0.45;
        marble.triggerShake();
        return true;
      }
    }
    return false;
  }

  // Draw a zigzag lightning bolt from (ax,ay) to (bx,by)
  _drawZigzag(ctx, ax, ay, bx, by, segs, amp) {
    const dx  = bx - ax, dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = -dy / len, ny = dx / len;  // perpendicular unit
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let i = 1; i <= segs; i++) {
      const t   = i / (segs + 1);
      const off = this._jitter[i % this._jitter.length] * amp;
      ctx.lineTo(ax + dx * t + nx * off, ay + dy * t + ny * off);
    }
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  render(ctx, cameraY) {
    const arms    = this._armEndpoints();
    const sx      = this.cx, sy = this.worldY - cameraY;
    const flicker = 0.55 + 0.45 * Math.sin(this.pulse);

    for (const arm of arms) {
      const sax = arm.ax, say = arm.ay - cameraY;
      const sbx = arm.bx, sby = arm.by - cameraY;

      // Outer corona glow
      ctx.shadowColor = `rgba(80,200,255,${flicker * 0.85})`;
      ctx.shadowBlur  = 22;
      ctx.lineWidth   = this.w + 5;
      ctx.strokeStyle = `rgba(0,80,200,${flicker * 0.45})`;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(sax, say);
      ctx.lineTo(sbx, sby);
      ctx.stroke();

      // Core electric arm
      ctx.shadowBlur  = 10;
      ctx.lineWidth   = this.w;
      ctx.strokeStyle = `rgba(30,170,255,${0.75 + flicker * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(sax, say);
      ctx.lineTo(sbx, sby);
      ctx.stroke();

      // Zigzag lightning overlay
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur  = 8;
      ctx.lineWidth   = 1.5;
      ctx.strokeStyle = `rgba(200,240,255,${flicker})`;
      this._drawZigzag(ctx, sax, say, sbx, sby, 6, 6);

      // Spark tips
      ctx.shadowBlur  = 16;
      ctx.shadowColor = 'rgba(255,255,100,0.95)';
      for (const [tx, ty] of [[sax, say], [sbx, sby]]) {
        ctx.beginPath();
        ctx.arc(tx, ty, 2.5 + flicker * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,160,${flicker * 0.9})`;
        ctx.fill();
      }
    }

    // Central glowing core
    ctx.shadowColor = 'rgba(180,230,255,1)';
    ctx.shadowBlur  = 24;
    const coreGrad  = ctx.createRadialGradient(sx, sy, 1, sx, sy, 7);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.5, '#55ccff');
    coreGrad.addColorStop(1, '#0055cc');
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fillStyle   = coreGrad;
    ctx.fill();
    ctx.lineWidth   = 2;
    ctx.strokeStyle = `rgba(180,230,255,${0.7 + flicker * 0.3})`;
    ctx.stroke();

    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
  }
}

// ── WallBlocker ───────────────────────────────────────────────────────────────
// A small electrified blue line that protrudes horizontally inward from the
// left or right track wall.  Hitting it bounces the marble back with high
// restitution instead of killing its speed.
class WallBlocker {
  constructor(worldY, side, wallX, protrude) {
    this.worldY = worldY;
    this.side   = side;   // 'left' | 'right'

    // Horizontal segment anchored to the wall, extending inward
    if (side === 'left') {
      this.ax = wallX;
      this.ay = worldY;
      this.bx = wallX + protrude;
      this.by = worldY;
    } else {
      this.ax = wallX - protrude;
      this.ay = worldY;
      this.bx = wallX;
      this.by = worldY;
    }

    this.pulse        = Math.random() * Math.PI * 2;
    this._jitter      = Array.from({ length: 10 }, () => Math.random() - 0.5);
    this._jitterTimer = 0;
  }

  update(dt) {
    this.pulse = (this.pulse + dt * 8) % (Math.PI * 2);
    this._jitterTimer -= dt;
    if (this._jitterTimer <= 0) {
      this._jitterTimer = 0.06;
      this._jitter = Array.from({ length: 10 }, () => Math.random() - 0.5);
    }
  }

  checkCollision(marble) {
    const hit = circleSegmentCollision(marble.x, marble.y, marble.radius, this.ax, this.ay, this.bx, this.by);
    if (!hit) return false;
    marble.x += hit.nx * hit.depth;
    marble.y += hit.ny * hit.depth;
    // Energetic bounce-back: keep most speed so the marble bounces away
    const dot = marble.vx * hit.nx + marble.vy * hit.ny;
    marble.vx = (marble.vx - 2 * dot * hit.nx) * 0.85;
    marble.vy = (marble.vy - 2 * dot * hit.ny) * 0.85;
    marble.triggerShake();
    return true;
  }

  // Zigzag lightning bolt between two points
  _drawZigzag(ctx, ax, ay, bx, by, segs, amp) {
    const dx  = bx - ax, dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = -dy / len, ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let i = 1; i <= segs; i++) {
      const t   = i / (segs + 1);
      const off = this._jitter[i % this._jitter.length] * amp;
      ctx.lineTo(ax + dx * t + nx * off, ay + dy * t + ny * off);
    }
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  render(ctx, cameraY) {
    const sax = this.ax, say = this.ay - cameraY;
    const sbx = this.bx, sby = this.by - cameraY;
    const flicker = 0.55 + 0.45 * Math.sin(this.pulse);

    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    // Outer corona glow
    ctx.shadowColor = `rgba(80,200,255,${flicker * 0.9})`;
    ctx.shadowBlur  = 18;
    ctx.lineWidth   = 7;
    ctx.strokeStyle = `rgba(0,100,255,${flicker * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(sax, say);
    ctx.lineTo(sbx, sby);
    ctx.stroke();

    // Core bright blue line
    ctx.shadowBlur  = 8;
    ctx.lineWidth   = 2.5;
    ctx.strokeStyle = `rgba(30,170,255,${0.8 + flicker * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(sax, say);
    ctx.lineTo(sbx, sby);
    ctx.stroke();

    // Electric zigzag overlay
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur  = 6;
    ctx.lineWidth   = 1;
    ctx.strokeStyle = `rgba(180,240,255,${flicker})`;
    this._drawZigzag(ctx, sax, say, sbx, sby, 5, 4);

    // Wall-anchor node
    const nodeX = this.side === 'left' ? sax : sbx;
    const nodeY = this.side === 'left' ? say : sby;
    ctx.shadowColor = 'rgba(100,200,255,1)';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, 3 + flicker * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(150,220,255,${0.7 + flicker * 0.3})`;
    ctx.fill();

    // Tip spark
    const tipX = this.side === 'left' ? sbx : sax;
    const tipY = this.side === 'left' ? sby : say;
    ctx.shadowBlur  = 14;
    ctx.shadowColor = 'rgba(255,255,100,0.95)';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 2 + flicker * 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,160,${flicker * 0.9})`;
    ctx.fill();

    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
  }
}

// ── DoorGate ──────────────────────────────────────────────────────────────────
// Three doors spanning the full track width.
// One randomly-chosen door is open (pulses green) and lets the marble through.
// The other two are blocked (pulse red) and bounce the marble back.
class DoorGate {
  constructor(worldY, leftWall, rightWall) {
    this.worldY = worldY;
    this.h      = 22;   // door height in pixels
    this.pulse  = Math.random() * Math.PI * 2;   // start at random phase

    this.correctDoor = Math.floor(Math.random() * 3);   // 0, 1, or 2
    this.scoreGiven  = false;   // true once marble has passed through
    this.hitRed      = false;   // true if marble bounced off a red door before passing

    // Divide the track into 3 equal doors with 3 px gaps between them
    const gap    = 3;
    const totalW = rightWall - leftWall - gap * 2;
    const doorW  = totalW / 3;
    this.doors = [
      { x: leftWall,                       w: doorW },
      { x: leftWall + (doorW + gap),        w: doorW },
      { x: leftWall + (doorW + gap) * 2,    w: doorW },
    ];

    // Pre-computed lightning bolt paths (2 bolts × 3 doors)
    // Refreshed in update() every ~80 ms to create a controlled crackle
    this._boltTimer = 0;
    this._bolts = []; // array of { points: [{x,y},...] }
    this._rebuildBolts();
  }

  // Regenerate all bolt point arrays
  _rebuildBolts() {
    this._bolts = [];
    for (let i = 0; i < 3; i++) {
      const door    = this.doors[i];
      const isOpen  = i === this.correctDoor;
      const x1 = door.x, x2 = door.x + door.w;
      for (let b = 0; b < 2; b++) {
        const yBase = b === 0 ? -3 : 3;
        const segs  = b === 0 ? 8 : 6;
        const amp   = isOpen ? 5 : 9;
        const pts   = [{ x: x1, y: yBase }];
        for (let j = 1; j < segs; j++) {
          pts.push({
            x: x1 + (j / segs) * (x2 - x1),
            y: yBase + (Math.random() - 0.5) * amp * 2,
          });
        }
        pts.push({ x: x2, y: yBase });
        this._bolts.push({ door: i, bolt: b, pts });
      }
    }
  }

  update(dt) {
    this.pulse = (this.pulse + dt * 3.5) % (Math.PI * 2);
    // Refresh bolt shapes ~every 80 ms for a controlled crackle effect
    this._boltTimer -= dt;
    if (this._boltTimer <= 0) {
      this._boltTimer = 0.08;
      this._rebuildBolts();
    }
  }

  checkCollision(marble) {
    let blocked = false;
    for (let i = 0; i < 3; i++) {
      if (i === this.correctDoor) continue;   // open door – no collision
      const door = this.doors[i];
      const hit  = circleRectCollision(
        marble.x, marble.y, marble.radius,
        door.x, this.worldY - this.h / 2, door.w, this.h
      );
      if (!hit) continue;
      marble.x += hit.nx * hit.depth;
      marble.y += hit.ny * hit.depth;
      const dot = marble.vx * hit.nx + marble.vy * hit.ny;
      marble.vx = (marble.vx - 2 * dot * hit.nx) * 0.50;
      marble.vy = (marble.vy - 2 * dot * hit.ny) * 0.50;
      marble.triggerShake();
      this.hitRed = true;
      blocked = true;
    }
    return blocked;
  }

  render(ctx, cameraY) {
    const centerY = this.worldY - cameraY;
    if (centerY < -60 || centerY > 760) return;

    const sinP     = Math.sin(this.pulse);
    const pulse    = 0.55 + 0.45 * sinP;
    const glowSize = 16 + 10 * sinP;

    for (let i = 0; i < 3; i++) {
      const door   = this.doors[i];
      const isOpen = i === this.correctDoor;

      const x1 = door.x;
      const x2 = door.x + door.w;

      const baseR  = isOpen ?   0 : 255;
      const baseG  = isOpen ? 255 :  40;
      const baseB  = isOpen ? 100 :  60;
      const glowC  = isOpen ? '#00ff66' : '#ff2244';

      ctx.save();

      // Soft electric field glow between endpoints
      const fieldGrad = ctx.createLinearGradient(x1, centerY - 16, x1, centerY + 16);
      const fa = (isOpen ? 0.10 : 0.18) + 0.08 * sinP;
      fieldGrad.addColorStop(0,   `rgba(${baseR},${baseG},${baseB},0)`);
      fieldGrad.addColorStop(0.5, `rgba(${baseR},${baseG},${baseB},${fa})`);
      fieldGrad.addColorStop(1,   `rgba(${baseR},${baseG},${baseB},0)`);
      ctx.fillStyle = fieldGrad;
      ctx.fillRect(x1, centerY - 16, door.w, 32);

      // Draw pre-computed lightning-bolt lines (refreshed ~every 80 ms)
      for (const boltData of this._bolts) {
        if (boltData.door !== i) continue;
        const b    = boltData.bolt;
        const pts  = boltData.pts;
        const alpha = (isOpen ? 0.65 : 0.90) - b * 0.15 + 0.15 * sinP;

        ctx.shadowColor = glowC;
        ctx.shadowBlur  = glowSize * (b === 0 ? 1 : 0.55);
        ctx.strokeStyle = `rgba(${baseR},${baseG},${baseB},${alpha})`;
        ctx.lineWidth   = b === 0 ? 2 : 1.2;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';

        ctx.beginPath();
        ctx.moveTo(pts[0].x, centerY + pts[0].y);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(pts[k].x, centerY + pts[k].y);
        }
        ctx.stroke();
      }

      // Endpoint spark nodes
      const nodeAlpha = 0.7 + 0.3 * pulse;
      ctx.shadowColor = glowC;
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = `rgba(${baseR},${baseG},${baseB},${nodeAlpha})`;
      for (const nx of [x1, x2]) {
        ctx.beginPath();
        ctx.arc(nx, centerY, 3 + sinP, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Pass/block icon centred on the door segment
      ctx.save();
      ctx.globalAlpha   = 0.65 + 0.35 * sinP;
      ctx.fillStyle     = isOpen ? '#ccffdd' : '#ffcccc';
      ctx.shadowColor   = glowC;
      ctx.shadowBlur    = 6;
      ctx.font          = 'bold 11px monospace';
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'middle';
      ctx.fillText(isOpen ? '✓' : '✕', (x1 + x2) / 2, centerY);
      ctx.restore();
    }
  }
}

// ── Dynamic obstacle generator ────────────────────────────────────────────────
// Builds a list of obstacles for a given vertical world-space range.
// difficulty: 0 (easy) → 1 (hard)
// track: Track instance used to query wall positions
// allowDoor: when false the door-gate case falls back to a wall blocker
function buildObstaclesForRange(fromY, toY, difficulty, track, allowDoor = true) {
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
    if (rand < 0.20) {
      // Rotating bar – random pivot position, not always centered
      const margin  = 22;
      const pivotX  = left + margin + Math.random() * (width - margin * 2);
      const maxHalf = Math.min(pivotX - left, right - pivotX) * 0.85;
      const halfLen = Math.min(34 + Math.random() * 26, maxHalf);
      const spd     = (1.4 + difficulty * 1.8) * (Math.random() < 0.5 ? 1 : -1);
      obs.push(new RotatingBar(pivotX, y, halfLen, spd));
    } else if (rand < 0.42) {
      // Electrified spinner – multi-arm, placed anywhere across the track
      const margin  = 18;
      const pivotX  = left + margin + Math.random() * (width - margin * 2);
      const maxHalf = Math.min(pivotX - left, right - pivotX) * 0.88;
      const halfLen = Math.min(30 + Math.random() * 28, maxHalf);
      const spd     = (1.6 + difficulty * 2.0) * (Math.random() < 0.5 ? 1 : -1);
      const arms    = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4 arms
      obs.push(new ElectricSpinner(pivotX, y, halfLen, spd, arms));
    } else if (rand < 0.64) {
      // Moving blocker
      const blkW   = 42 + Math.random() * 22;
      const margin = 10;
      const spd    = 90 + Math.random() * (80 + difficulty * 80);
      obs.push(new MovingBlocker(y, left + margin, right - margin, spd, blkW, 14));
    } else if (rand < 0.84) {
      // Wall blocker – small electrified blue line protruding from left or right wall
      const side    = Math.random() < 0.5 ? 'left' : 'right';
      const protrude = 28 + Math.random() * 22; // 28–50 px – small but visible
      const wallX   = side === 'left' ? left : right;
      obs.push(new WallBlocker(y, side, wallX, protrude));
    } else if (rand < 0.90) {
      // Boost pad (reward, not hazard)
      obs.push(new BoostPad(cx, y, width));
    } else if (allowDoor) {
      // Door gate – three doors spanning the track, only one is passable
      obs.push(new DoorGate(y, left, right));
    } else {
      // Door suppressed (too soon after last door) – use a wall blocker instead
      const side    = Math.random() < 0.5 ? 'left' : 'right';
      const protrude = 28 + Math.random() * 22;
      const wallX   = side === 'left' ? left : right;
      obs.push(new WallBlocker(y, side, wallX, protrude));
    }
  }

  return obs;
}
