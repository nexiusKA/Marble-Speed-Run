// ── Void Entity ───────────────────────────────────────────────────────────────
// A dark void creature made of shadowy clouds that chases the marble.
// this.y is its leading (bottom) edge in world coordinates.
// The class is still named Fog so no other file needs changing.

const VOID_CLOUD_H  = 60;  // depth of the cloud fringe below the leading edge
const VOID_EYE_GLOW = 18;  // radius of each eye glow

class Fog {
  constructor(marbleStartY) {
    // Start 400 world-units above the marble's start position.
    this.y         = marbleStartY - 400;
    this.speed     = 200;   // px/s – updated each frame
    this.slowTimer = 0;     // remaining seconds of bar-slow pickup effect
    this.time      = 0;     // accumulated time used for cloud/eye animation
  }

  // distance: metres travelled by the marble this run
  update(dt, distance) {
    this.time += dt;
    const d = Math.max(0, distance);
    if (d <= 10000) {
      // Gentle ramp: 200 px/s at start → 300 px/s at 10 000 m
      this.speed = 200 + d * 0.01;
    } else {
      // After 10 000 m: base increases by 50 px/s every 5 000 m (capped at 750 px/s),
      // with a gentle continuous ramp within each band for a smooth feel.
      const steps = Math.floor((d - 10000) / 5000);
      const rem   = (d - 10000) % 5000;
      this.speed  = Math.min(300 + steps * 50 + rem * 0.01, 750);
    }

    const effective = this.slowTimer > 0 ? this.speed * 0.35 : this.speed;
    if (this.slowTimer > 0) this.slowTimer -= dt;

    this.y += effective * dt;
  }

  slowDown(duration) {
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  // True when the void's leading edge has reached the marble
  isCatching(marble) {
    return this.y >= marble.y - marble.radius;
  }

  // 0 = far away, 1 = touching; meaningful when gap < 500 px
  dangerRatio(marble) {
    const gap = marble.y - marble.radius - this.y;
    return clamp(1 - gap / 500, 0, 1);
  }

  render(ctx, cameraY) {
    const t        = this.time;
    const voidEdge = this.y - cameraY;  // screen Y of the leading (bottom) edge

    // Nothing to draw if the void is entirely below the screen
    if (voidEdge > CANVAS_H) return;

    // ── Dark void body above the leading edge ──────────────────────────────
    const bodyBottom = Math.min(voidEdge, CANVAS_H);
    if (bodyBottom > 0) {
      ctx.fillStyle = 'rgba(0,0,10,0.94)';
      ctx.fillRect(0, 0, CANVAS_W, bodyBottom);

      // Subtle purple shimmer near the edge
      if (voidEdge > 0) {
        const shimmerH = Math.min(80, voidEdge);
        const shimmer  = ctx.createLinearGradient(0, voidEdge - shimmerH, 0, voidEdge);
        shimmer.addColorStop(0, 'rgba(60,0,100,0)');
        shimmer.addColorStop(1, 'rgba(80,0,180,0.45)');
        ctx.fillStyle = shimmer;
        ctx.fillRect(0, voidEdge - shimmerH, CANVAS_W, shimmerH);
      }
    } else {
      // Void entirely above screen – nothing visible
      return;
    }

    // ── Cloud fringe – undulating bottom edge ──────────────────────────────
    if (voidEdge < CANVAS_H) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, voidEdge);
      const steps = Math.ceil(CANVAS_W / 4);
      for (let i = 0; i <= steps; i++) {
        const x     = i * 4;
        const bulge =
          Math.sin(x * 0.030 + t * 1.8) * 14 +
          Math.sin(x * 0.070 - t * 2.6) * 8  +
          Math.sin(x * 0.015 + t * 0.9) * 20;
        ctx.lineTo(x, voidEdge + bulge + VOID_CLOUD_H * 0.3);
      }
      ctx.lineTo(CANVAS_W, voidEdge + VOID_CLOUD_H);
      ctx.lineTo(0,        voidEdge + VOID_CLOUD_H);
      ctx.closePath();

      const cloudGrad = ctx.createLinearGradient(0, voidEdge, 0, voidEdge + VOID_CLOUD_H);
      cloudGrad.addColorStop(0,   'rgba(20,0,50,0.85)');
      cloudGrad.addColorStop(0.5, 'rgba(10,0,30,0.55)');
      cloudGrad.addColorStop(1,   'rgba(0,0,10,0)');
      ctx.fillStyle = cloudGrad;
      ctx.fill();
      ctx.restore();

      // Glow at the void's leading edge
      const glowH    = 28;
      const glowGrad = ctx.createLinearGradient(0, voidEdge, 0, voidEdge + glowH);
      glowGrad.addColorStop(0, 'rgba(140,0,255,0.50)');
      glowGrad.addColorStop(1, 'rgba(60,0,120,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, voidEdge, CANVAS_W, Math.min(glowH, CANVAS_H - voidEdge));
    }

    // ── Eyes – creature gaze emerging from the darkness ───────────────────
    // Three pairs of glowing eyes scattered across the leading edge
    const eyeGroups = [
      { cx: CANVAS_W * 0.18, phase: 0.0 },
      { cx: CANVAS_W * 0.50, phase: 1.3 },
      { cx: CANVAS_W * 0.78, phase: 2.6 },
    ];

    for (const eg of eyeGroups) {
      // Slow pulse; blink when sin spikes above threshold
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.5 + eg.phase);
      const blink = Math.sin(t * 4.1 + eg.phase * 1.7) > 0.88 ? 0 : 1;
      const alpha = pulse * blink;
      const eyeY  = voidEdge + 12 + Math.sin(t * 0.8 + eg.phase) * 6;

      for (let side = -1; side <= 1; side += 2) {
        const ex = eg.cx + side * 7;

        // Outer glow halo
        const glow = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, VOID_EYE_GLOW);
        glow.addColorStop(0,    `rgba(255,220,255,${(0.85 * alpha).toFixed(2)})`);
        glow.addColorStop(0.25, `rgba(200,80,255,${(0.70 * alpha).toFixed(2)})`);
        glow.addColorStop(0.6,  `rgba(100,0,200,${(0.30 * alpha).toFixed(2)})`);
        glow.addColorStop(1,    'rgba(40,0,80,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, VOID_EYE_GLOW, VOID_EYE_GLOW * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dark pupil
        if (blink) {
          ctx.fillStyle = `rgba(5,0,15,${(0.9 * alpha).toFixed(2)})`;
          ctx.beginPath();
          ctx.ellipse(ex, eyeY, 3.5, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}
