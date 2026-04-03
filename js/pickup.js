// ── Pickups ───────────────────────────────────────────────────────────────────
// Collectible items that give the player an edge over the chasing fog.

const PICKUP_CONFIG = {
  speed:    { color1: '#ffe040', color2: '#ff8800', label: '⚡', name: 'SPEED BOOST!' },
  dash:     { color1: '#40ffff', color2: '#0077ff', label: '▶▶', name: 'DASH!'        },
  fog_slow: { color1: '#dd88ff', color2: '#7700cc', label: '❄',  name: 'BAR SLOWED!' },
  shield:   { color1: '#88ff99', color2: '#008844', label: '◆',  name: 'SHIELD!'     },
  ghost:    { color1: '#ee88ff', color2: '#6600cc', label: '◈',  name: 'GHOST MODE!' },
};

class Pickup {
  constructor(x, worldY, type) {
    this.x         = x;
    this.worldY    = worldY;
    this.type      = type;
    this.radius    = 13;
    this.collected = false;
    this.pulse     = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.pulse = (this.pulse + dt * 2.5) % (Math.PI * 2);
  }

  checkCollision(marble, game) {
    if (this.collected) return;
    const dx = marble.x - this.x;
    const dy = marble.y - this.worldY;
    if (dx * dx + dy * dy < (marble.radius + this.radius) ** 2) {
      this.collected = true;
      game.applyPickup(this.type);
    }
  }

  render(ctx, cameraY) {
    if (this.collected) return;
    const sy = this.worldY - cameraY;
    if (sy < -40 || sy > CANVAS_H + 40) return;

    ctx.save();

    const cfg  = PICKUP_CONFIG[this.type];
    const glow = 0.5 + 0.5 * Math.sin(this.pulse);
    const r    = this.radius * (1 + glow * 0.12);

    // Outer glow
    ctx.shadowColor = cfg.color1;
    ctx.shadowBlur  = 12 + glow * 10;

    // Filled circle
    const grad = ctx.createRadialGradient(
      this.x - 3, sy - 3, 2,
      this.x, sy, r
    );
    grad.addColorStop(0, cfg.color1);
    grad.addColorStop(1, cfg.color2);
    ctx.beginPath();
    ctx.arc(this.x, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Thin ring
    ctx.beginPath();
    ctx.arc(this.x, sy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Icon label
    ctx.font          = 'bold 10px sans-serif';
    ctx.fillStyle     = 'rgba(255,255,255,0.95)';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(cfg.label, this.x, sy);

    ctx.restore();
  }
}
