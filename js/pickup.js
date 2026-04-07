// ── Pickups ───────────────────────────────────────────────────────────────────
// Collectible items that give the player an edge over the chasing fog.

const PICKUP_CONFIG = {
  speed:      { color1: '#ffe040', color2: '#ff8800', label: '⚡',  name: 'SPEED BOOST!'  },
  magnet:     { color1: '#ff88ff', color2: '#cc00cc', label: '🧲', name: 'MAGNET!'        },
  fog_slow:   { color1: '#dd88ff', color2: '#7700cc', label: '❄',  name: 'BAR SLOWED!'   },
  shield:     { color1: '#88ff99', color2: '#008844', label: '◆',  name: 'SHIELD!'        },
  ghost:      { color1: '#ee88ff', color2: '#6600cc', label: '◈',  name: 'GHOST MODE!'   },
  power_rush:  { color1: '#ffdd00', color2: '#ff4400', label: '⚡⚡', name: 'POWER RUSH!'  },
  rush_extend: { color1: '#00ffcc', color2: '#0066ff', label: '⏱+2', name: '⏱ RUSH +2s!' },
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

// ── Coin ──────────────────────────────────────────────────────────────────────
// A small collectible coin that appears along the normal track.
// Collected coins are converted to bonus metres at game over.

class Coin {
  constructor(x, worldY) {
    this.x         = x;
    this.worldY    = worldY;
    this.radius    = 7;
    this.collected = false;
    this.pulse     = Math.random() * Math.PI * 2;
    this.bob       = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.pulse = (this.pulse + dt * 4.0) % (Math.PI * 2);
    this.bob   = (this.bob   + dt * 2.5) % (Math.PI * 2);
  }

  checkCollision(marble, game, dt = 1 / 60) {
    if (this.collected) return;
    const dx = marble.x - this.x;
    const dy = marble.y - this.worldY;
    // Magnet attraction: pull coin toward marble when magnet is active
    if (game.magnetTimer > 0) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const magnetRadius = 160;
      if (dist < magnetRadius && dist > 0) {
        const speed = 400 * (1 - dist / magnetRadius);
        this.x      += (dx / dist) * speed * dt;
        this.worldY += (dy / dist) * speed * dt;
      }
    }
    if (dx * dx + dy * dy < (marble.radius + this.radius) ** 2) {
      this.collected = true;
      game.collectCoin();
    }
  }

  render(ctx, cameraY) {
    if (this.collected) return;
    const sy = this.worldY - cameraY + Math.sin(this.bob) * 3;
    if (sy < -30 || sy > CANVAS_H + 30) return;

    ctx.save();

    const glow = 0.5 + 0.5 * Math.sin(this.pulse);

    // Outer glow
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 10 + glow * 8;

    // Coin body gradient
    const grad = ctx.createRadialGradient(
      this.x - 2, sy - 2, 1,
      this.x, sy, this.radius
    );
    grad.addColorStop(0, '#fff4a0');
    grad.addColorStop(1, '#cc8800');
    ctx.beginPath();
    ctx.arc(this.x, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Outer ring
    ctx.beginPath();
    ctx.arc(this.x, sy, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,220,50,${0.6 + glow * 0.4})`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Coin symbol
    ctx.font         = 'bold 8px sans-serif';
    ctx.fillStyle    = 'rgba(160,90,0,0.9)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¢', this.x, sy);

    ctx.restore();
  }
}
