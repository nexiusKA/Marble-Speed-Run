// ── Crusher Bar ──────────────────────────────────────────────────────────────
// A steel crusher bar that descends from above, chasing the marble.
// this.y is its leading (bottom) edge in world coordinates.
// The class is still named Fog so no other file needs changing.

const BAR_H        = 32;  // visible bar thickness in px
const BAR_STRIPE_W = 22;  // width of each hazard stripe

class Fog {
  constructor(marbleStartY) {
    // Start 400 world-units above the marble's start position.
    this.y         = marbleStartY - 400;
    this.speed     = 200;   // px/s – updated each frame
    this.slowTimer = 0;     // remaining seconds of bar-slow pickup effect
  }

  // distance: metres travelled by the marble this run
  update(dt, distance) {
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

  // True when the bar's bottom edge has reached the marble
  isCatching(marble) {
    return this.y >= marble.y - marble.radius;
  }

  // 0 = far away, 1 = touching; meaningful when gap < 500 px
  dangerRatio(marble) {
    const gap = marble.y - marble.radius - this.y;
    return clamp(1 - gap / 500, 0, 1);
  }

  render(ctx, cameraY) {
    // barBottom: screen Y of the bar's leading (bottom) edge
    const barBottom = this.y - cameraY;
    const barTop    = barBottom - BAR_H;

    // ── Dark mass above the bar (the "wall" the player is fleeing) ─────────
    if (barTop > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.80)';
      ctx.fillRect(0, 0, CANVAS_W, barTop);
    } else if (barBottom > 0) {
      // Bar has scrolled partly off the top – fill the whole visible portion
      ctx.fillStyle = 'rgba(0,0,0,0.80)';
      ctx.fillRect(0, 0, CANVAS_W, barBottom);
    } else {
      // Bar is entirely above the screen – the full canvas is below the bar,
      // so there is nothing to darken.
      return;
    }

    // Skip drawing the bar body if it is off-screen
    if (barTop > CANVAS_H) return;

    const drawTop = Math.max(barTop, 0);
    const drawH   = Math.min(barBottom, CANVAS_H) - drawTop;
    if (drawH <= 0) return;

    // ── Steel body ────────────────────────────────────────────────────────
    // Gradient is anchored to the bar's world position so the metal texture
    // stays consistent even when the bar is partially clipped by the top edge.
    const metal = ctx.createLinearGradient(0, barTop, 0, barBottom);
    metal.addColorStop(0,    '#2a2a3a');
    metal.addColorStop(0.12, '#72728a');
    metal.addColorStop(0.38, '#b8b8cc');
    metal.addColorStop(0.52, '#dcdcec');
    metal.addColorStop(0.68, '#9494aa');
    metal.addColorStop(0.86, '#585868');
    metal.addColorStop(1,    '#1e1e2a');
    ctx.fillStyle = metal;
    ctx.fillRect(0, drawTop, CANVAS_W, drawH);

    // ── Hazard stripe band along the bottom edge ──────────────────────────
    const stripeH  = 7;
    const stripeY  = barBottom - stripeH;
    if (stripeY < CANVAS_H && stripeY + stripeH > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, Math.max(stripeY, 0), CANVAS_W, Math.min(stripeH, CANVAS_H - stripeY));
      ctx.clip();
      for (let x = 0; x < CANVAS_W + BAR_STRIPE_W; x += BAR_STRIPE_W * 2) {
        ctx.fillStyle = 'rgba(255,190,0,0.82)';
        ctx.fillRect(x,                stripeY, BAR_STRIPE_W, stripeH);
        ctx.fillStyle = 'rgba(18,18,18,0.82)';
        ctx.fillRect(x + BAR_STRIPE_W, stripeY, BAR_STRIPE_W, stripeH);
      }
      ctx.restore();
    }

    // ── Danger glow below the bar ─────────────────────────────────────────
    if (barBottom < CANVAS_H) {
      const glowH    = 20;
      const glowGrad = ctx.createLinearGradient(0, barBottom, 0, barBottom + glowH);
      glowGrad.addColorStop(0, 'rgba(255,100,0,0.55)');
      glowGrad.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, barBottom, CANVAS_W, Math.min(glowH, CANVAS_H - barBottom));
    }

    // ── Rivets along the upper third of the bar ───────────────────────────
    const rivetY = barTop + BAR_H * 0.32;
    if (rivetY >= 0 && rivetY < CANVAS_H) {
      const rivetR   = 3.5;
      const rivetGap = 44;
      for (let x = rivetGap / 2; x < CANVAS_W; x += rivetGap) {
        const rg = ctx.createRadialGradient(x - 1, rivetY - 1, 0, x, rivetY, rivetR);
        rg.addColorStop(0,   '#ffffff');
        rg.addColorStop(0.4, '#aaaacc');
        rg.addColorStop(1,   '#2a2a3a');
        ctx.beginPath();
        ctx.arc(x, rivetY, rivetR, 0, Math.PI * 2);
        ctx.fillStyle = rg;
        ctx.fill();
      }
    }

    // ── Top highlight scratch line ────────────────────────────────────────
    if (barTop >= 0 && barTop < CANVAS_H) {
      ctx.strokeStyle = 'rgba(220,220,240,0.50)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(0, barTop + 2);
      ctx.lineTo(CANVAS_W, barTop + 2);
      ctx.stroke();
    }
  }
}
