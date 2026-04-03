// ── Fog ───────────────────────────────────────────────────────────────────────
// The fog chases the marble from behind (smaller world Y = above the marble on
// screen).  If its leading edge reaches the marble the run ends.

class Fog {
  constructor(marbleStartY) {
    // Start 400 world-units behind the marble's start position.
    // This gap gives the player a brief moment to accelerate before the fog
    // becomes visible at the top of the screen (~196 px into the viewport).
    this.y         = marbleStartY - 400;
    this.speed     = 400;   // px/s – updated each frame
    this.slowTimer = 0;     // remaining seconds of fog-slow pickup effect
  }

  // elapsedSec: seconds the current run has been active
  update(dt, elapsedSec) {
    // Speed ramps from 400 px/s up to 900 px/s over the first 100 seconds
    this.speed = 400 + Math.min(elapsedSec * 5, 500);

    const effective = this.slowTimer > 0 ? this.speed * 0.35 : this.speed;
    if (this.slowTimer > 0) this.slowTimer -= dt;

    this.y += effective * dt;
  }

  slowDown(duration) {
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  // True when the fog's leading edge has reached the marble
  isCatching(marble) {
    return this.y >= marble.y - marble.radius;
  }

  // 0 = far away, 1 = touching; meaningful when gap < 500 px
  dangerRatio(marble) {
    const gap = marble.y - marble.radius - this.y;
    return clamp(1 - gap / 500, 0, 1);
  }

  render(ctx, cameraY) {
    // fog.y is the leading edge (lowest world Y = highest on screen)
    // fogScreenY < marbleScreenY, approaches from the top of the viewport
    const fogScreenY = this.y - cameraY;

    // ── Always show a faint purple haze at the very top of the screen ──────
    // danger ramps from 0 (fog far off-screen, fogScreenY < -600) to 1 (fog at screen top)
    const danger = clamp((fogScreenY + 600) / 600, 0, 1);
    if (danger > 0) {
      const hazeH = 60 + danger * 80;
      const haze  = ctx.createLinearGradient(0, 0, 0, hazeH);
      haze.addColorStop(0, `rgba(60,0,100,${0.12 + danger * 0.45})`);
      haze.addColorStop(1, 'rgba(60,0,100,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, CANVAS_W, hazeH);
    }

    // ── Fog body fills from screen top down to the leading edge ───────────
    if (fogScreenY <= 0) {
      // Fog covers the entire viewport (or higher)
      ctx.fillStyle = 'rgba(55,0,90,0.88)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    if (fogScreenY >= CANVAS_H) return; // Leading edge is below screen — not visible

    const grad = ctx.createLinearGradient(0, 0, 0, fogScreenY);
    grad.addColorStop(0,   'rgba(55,0,90,0.88)');
    grad.addColorStop(0.6, 'rgba(70,0,115,0.50)');
    grad.addColorStop(1,   'rgba(110,20,170,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, fogScreenY);

    // ── Animated tendrils at the leading edge ─────────────────────────────
    const t = Date.now() / 1000;
    for (let i = 0; i < 7; i++) {
      const xBase = (i / 6) * CANVAS_W;
      const sway  = Math.sin(t * 1.1 + i * 0.85) * 22;
      const dip   = Math.abs(Math.sin(t * 0.75 + i * 1.2)) * 28;
      ctx.beginPath();
      ctx.ellipse(
        xBase + sway, fogScreenY + dip * 0.5,
        34 + dip * 0.6, 16 + dip * 0.35,
        0, 0, Math.PI * 2
      );
      ctx.fillStyle = 'rgba(100,0,160,0.14)';
      ctx.fill();
    }
  }
}
