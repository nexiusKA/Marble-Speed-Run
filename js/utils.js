// ── Utils ────────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Segment–point closest approach (returns t in [0,1] and closest point)
function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { t: 0, x: ax, y: ay };
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  return { t, x: ax + t * dx, y: ay + t * dy };
}

// Circle vs segment collision: returns penetration normal {nx,ny,depth} or null
function circleSegmentCollision(cx, cy, r, ax, ay, bx, by) {
  const { x, y } = closestPointOnSegment(cx, cy, ax, ay, bx, by);
  const dx = cx - x, dy = cy - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= r || d < 1e-9) return null;
  return { nx: dx / d, ny: dy / d, depth: r - d };
}

// Simple AABB vs Circle
function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
  const nearX = clamp(cx, rx, rx + rw);
  const nearY = clamp(cy, ry, ry + rh);
  const dx = cx - nearX, dy = cy - nearY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= r || d < 1e-9) return null;
  const nx = d < 1e-9 ? 1 : dx / d;
  const ny = d < 1e-9 ? 0 : dy / d;
  return { nx, ny, depth: r - d };
}

// Rotated rect corner helpers for obstacles
function rotatePoint(px, py, cx, cy, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = px - cx, dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

// CanvasRenderingContext2D.roundRect polyfill for older browsers
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
  };
}
