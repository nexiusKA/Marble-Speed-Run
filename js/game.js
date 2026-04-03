// ── Game ─────────────────────────────────────────────────────────────────────

const STATE = { MENU: 'menu', RUNNING: 'running', FINISHED: 'finished' };

class Game {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;

    this.input     = new Input();
    this.ui        = new UI();
    this.track     = new Track();
    this.marble    = new Marble(this.track.startX, this.track.startY);
    this.obstacles = buildObstacles();

    this.state     = STATE.MENU;
    this.elapsed   = 0;        // ms
    this.bestTime  = Infinity; // ms
    this.cameraY   = 0;        // world Y of top of screen

    // Particle pool
    this.particles = [];

    // Shake state
    this.shakeX = 0;
    this.shakeY = 0;

    this.ui.showStart(() => this.startRun());
    this.ui.updateBest(this.bestTime);
  }

  startRun() {
    this.marble.reset(this.track.startX, this.track.startY);
    this.obstacles = buildObstacles();
    this.elapsed   = 0;
    this.particles = [];
    this.cameraY   = this.track.startY - CANVAS_H * 0.28;
    this.state     = STATE.RUNNING;
    this.ui.updateTimer(0);
  }

  restart() {
    this.ui.hideFinish();
    this.startRun();
  }

  update(dt) {
    if (this.state !== STATE.RUNNING) return;

    // Restart hotkey
    if (this.input.consumeRestart()) {
      this.restart();
      return;
    }

    this.elapsed += dt * 1000;

    // Update marble
    this.marble.update(dt, this.input, this.track);

    // Obstacle updates + collision
    for (const obs of this.obstacles) {
      obs.update(dt);
      obs.checkCollision(this.marble);
    }

    // Spawn speed particles
    const speed = this.marble.speed;
    if (speed > 300 && Math.random() < dt * 12) {
      this._spawnParticle(this.marble.x, this.marble.y);
    }

    // Update particles
    this._updateParticles(dt);

    // Camera smoothing: target = marble near top-third of screen
    const targetCamY = this.marble.y - CANVAS_H * 0.28;
    this.cameraY     = lerp(this.cameraY, targetCamY, clamp(dt * 7, 0, 1));

    // Screen shake from marble
    if (this.marble.shakeTimer > 0) {
      this.shakeX = (Math.random() - 0.5) * 8;
      this.shakeY = (Math.random() - 0.5) * 8;
    } else {
      this.shakeX = lerp(this.shakeX, 0, dt * 15);
      this.shakeY = lerp(this.shakeY, 0, dt * 15);
    }

    // Out of bounds → reset to last checkpoint
    if (this.track.isOutOfBounds(this.marble)) {
      this._resetToCheckpoint();
      return;
    }

    // Finish detection
    if (this.track.hasFinished(this.marble)) {
      this._finishRun();
      return;
    }

    // Update HUD timer
    this.ui.updateTimer(this.elapsed);
  }

  _resetToCheckpoint() {
    const cpY = this.track.getCheckpointY(this.marble.y);
    const cpX = this.track.getCheckpointX(cpY);
    this.marble.reset(cpX, cpY > this.track.startY ? cpY - 20 : cpY);
  }

  _finishRun() {
    this.state = STATE.FINISHED;
    const time = this.elapsed;
    const isNew = time < this.bestTime;
    if (isNew) this.bestTime = time;
    this.ui.updateBest(this.bestTime);
    this.ui.showFinish(time, this.bestTime, () => this.restart());
  }

  _spawnParticle(x, y) {
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.6) * 60,
      life: 1,
      size: 2 + Math.random() * 3,
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.life -= dt * 2.5;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.save();

    // Screen shake
    ctx.translate(this.shakeX, this.shakeY);

    // Background
    ctx.fillStyle = '#0b0b1e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Background stars
    this._renderStars(ctx);

    // Track
    this.track.render(ctx, this.cameraY);

    // Obstacles
    for (const obs of this.obstacles) {
      obs.render(ctx, this.cameraY);
    }

    // Particles
    for (const p of this.particles) {
      const sy = p.y - this.cameraY;
      ctx.beginPath();
      ctx.arc(p.x, sy, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,200,255,${p.life * 0.8})`;
      ctx.fill();
    }

    // Marble – translate to world space so marble.x/y render correctly
    ctx.save();
    ctx.translate(0, -this.cameraY);
    // Trail and marble positions are in world space; translation converts to screen space
    this._renderMarble(ctx);
    ctx.restore();

    ctx.restore();
  }

  _renderMarble(ctx) {
    // Trail (world space, already translated by -cameraY via ctx)
    const trail = this.marble.trail;
    for (let i = 0; i < trail.length; i++) {
      const alpha = (i / trail.length) * 0.35;
      const r     = this.marble.radius * (i / trail.length) * 0.7;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, Math.max(r, 1), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120, 180, 255, ${alpha})`;
      ctx.fill();
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(
      this.marble.x, this.marble.y + this.marble.radius * 0.6,
      this.marble.radius * 0.9, this.marble.radius * 0.3, 0, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Marble gradient
    const grad = ctx.createRadialGradient(
      this.marble.x - this.marble.radius * 0.3,
      this.marble.y - this.marble.radius * 0.35,
      this.marble.radius * 0.1,
      this.marble.x, this.marble.y, this.marble.radius
    );
    grad.addColorStop(0, '#cce8ff');
    grad.addColorStop(0.45, '#4488ee');
    grad.addColorStop(1, '#112266');

    ctx.beginPath();
    ctx.arc(this.marble.x, this.marble.y, this.marble.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(
      this.marble.x - this.marble.radius * 0.28,
      this.marble.y - this.marble.radius * 0.3,
      this.marble.radius * 0.28, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    // Speed glow at high speed
    const speed = this.marble.speed;
    if (speed > 250) {
      const intensity = clamp((speed - 250) / 400, 0, 1);
      ctx.beginPath();
      ctx.arc(this.marble.x, this.marble.y, this.marble.radius * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80,160,255,${intensity * 0.25})`;
      ctx.fill();
    }
  }

  _renderStars(ctx) {
    // Static decorative stars in screen space – seeded by cameraY bucket
    const bucket = Math.floor(this.cameraY / CANVAS_H);
    const seed   = bucket * 1234567;
    for (let i = 0; i < 40; i++) {
      const sx = pseudoRand(seed + i * 7)      * CANVAS_W;
      const sy = pseudoRand(seed + i * 7 + 1)  * CANVAS_H;
      const r  = pseudoRand(seed + i * 7 + 2)  * 1.2 + 0.3;
      const a  = pseudoRand(seed + i * 7 + 3)  * 0.5 + 0.1;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,255,${a})`;
      ctx.fill();
    }
  }
}

// Simple deterministic pseudo-random from a seed (0..1)
function pseudoRand(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
