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
// BigCoin is the power-rush variant: ~2.5× larger and worth 2 coins each.

class Coin {
  constructor(x, worldY) {
    this.x         = x;
    this.worldY    = worldY;
    this.radius    = 14;
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
    ctx.font         = 'bold 12px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¢', this.x, sy);

    ctx.restore();
  }
}

// ── BlueCoin ──────────────────────────────────────────────────────────────────
// A rare blue coin that appears on the normal track and is worth 3 coins.
class BlueCoin {
  constructor(x, worldY) {
    this.x         = x;
    this.worldY    = worldY;
    this.radius    = 16;
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
      game.collectCoins(3);
    }
  }

  render(ctx, cameraY) {
    if (this.collected) return;
    const sy = this.worldY - cameraY + Math.sin(this.bob) * 3;
    if (sy < -30 || sy > CANVAS_H + 30) return;

    ctx.save();

    const glow = 0.5 + 0.5 * Math.sin(this.pulse);

    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur  = 12 + glow * 10;

    const grad = ctx.createRadialGradient(
      this.x - 2, sy - 2, 1,
      this.x, sy, this.radius
    );
    grad.addColorStop(0, '#aaddff');
    grad.addColorStop(1, '#0055cc');
    ctx.beginPath();
    ctx.arc(this.x, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(this.x, sy, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(100,180,255,${0.6 + glow * 0.4})`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.font         = 'bold 12px sans-serif';
    ctx.fillStyle    = 'rgba(220,240,255,0.95)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×3', this.x, sy);

    ctx.restore();
  }
}

// ── RedCoin ───────────────────────────────────────────────────────────────────
// A very rare red coin that appears on the normal track and is worth 5 coins.
class RedCoin {
  constructor(x, worldY) {
    this.x         = x;
    this.worldY    = worldY;
    this.radius    = 18;
    this.collected = false;
    this.pulse     = Math.random() * Math.PI * 2;
    this.bob       = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.pulse = (this.pulse + dt * 4.5) % (Math.PI * 2);
    this.bob   = (this.bob   + dt * 2.5) % (Math.PI * 2);
  }

  checkCollision(marble, game, dt = 1 / 60) {
    if (this.collected) return;
    const dx = marble.x - this.x;
    const dy = marble.y - this.worldY;
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
      game.collectCoins(5);
    }
  }

  render(ctx, cameraY) {
    if (this.collected) return;
    const sy = this.worldY - cameraY + Math.sin(this.bob) * 3;
    if (sy < -30 || sy > CANVAS_H + 30) return;

    ctx.save();

    const glow = 0.5 + 0.5 * Math.sin(this.pulse);

    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur  = 14 + glow * 12;

    const grad = ctx.createRadialGradient(
      this.x - 2, sy - 2, 1,
      this.x, sy, this.radius
    );
    grad.addColorStop(0, '#ffaaaa');
    grad.addColorStop(1, '#cc0000');
    ctx.beginPath();
    ctx.arc(this.x, sy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(this.x, sy, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,100,100,${0.6 + glow * 0.4})`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.font         = 'bold 12px sans-serif';
    ctx.fillStyle    = 'rgba(255,230,230,0.95)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×5', this.x, sy);

    ctx.restore();
  }
}

// ── BigCoin ───────────────────────────────────────────────────────────────────
// Power-rush exclusive coin: ~2.5× the radius of a normal coin, worth 2 coins.
class BigCoin {
  constructor(x, worldY) {
    this.x         = x;
    this.worldY    = worldY;
    this.radius    = 18;   // ~2.5× normal coin radius
    this.collected = false;
    this.pulse     = Math.random() * Math.PI * 2;
    this.bob       = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.pulse = (this.pulse + dt * 3.5) % (Math.PI * 2);
    this.bob   = (this.bob   + dt * 2.0) % (Math.PI * 2);
  }

  checkCollision(marble, game, dt = 1 / 60) {
    if (this.collected) return;
    const dx = marble.x - this.x;
    const dy = marble.y - this.worldY;
    if (game.magnetTimer > 0) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const magnetRadius = 200;
      if (dist < magnetRadius && dist > 0) {
        const speed = 400 * (1 - dist / magnetRadius);
        this.x      += (dx / dist) * speed * dt;
        this.worldY += (dy / dist) * speed * dt;
      }
    }
    if (dx * dx + dy * dy < (marble.radius + this.radius) ** 2) {
      this.collected = true;
      // Worth 2 coins
      game.collectCoin();
      game.collectCoin();
    }
  }

  render(ctx, cameraY) {
    if (this.collected) return;
    const sy = this.worldY - cameraY + Math.sin(this.bob) * 5;
    if (sy < -40 || sy > CANVAS_H + 40) return;

    ctx.save();

    const glow = 0.5 + 0.5 * Math.sin(this.pulse);
    const r    = this.radius;

    // Outer glow – brighter/larger than normal coin
    ctx.shadowColor = '#ffe033';
    ctx.shadowBlur  = 18 + glow * 14;

    // Coin body gradient
    const grad = ctx.createRadialGradient(
      this.x - r * 0.25, sy - r * 0.25, r * 0.1,
      this.x, sy, r
    );
    grad.addColorStop(0, '#fff9c4');
    grad.addColorStop(0.5, '#ffd700');
    grad.addColorStop(1, '#b8720a');
    ctx.beginPath();
    ctx.arc(this.x, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Outer ring
    ctx.beginPath();
    ctx.arc(this.x, sy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,230,60,${0.7 + glow * 0.3})`;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(this.x, sy, r * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180,110,0,0.6)`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // "×2" label
    ctx.font         = `bold ${Math.round(r * 0.72)}px sans-serif`;
    ctx.fillStyle    = 'rgba(100,55,0,0.95)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×2', this.x, sy);

    ctx.restore();
  }
}
