// ── Input ────────────────────────────────────────────────────────────────────

class Input {
  constructor() {
    this.left   = false;
    this.right  = false;
    this.down   = false;
    this.up     = false;
    this.restart = false;
    this._debugToggle = false; // fires once per # press

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    this._onBlur    = this._resetMovement.bind(this);
    window.addEventListener('keydown',          this._onKeyDown);
    window.addEventListener('keyup',            this._onKeyUp);
    window.addEventListener('blur',             this._onBlur);
    document.addEventListener('visibilitychange', this._onBlur);

    // Touch joystick (Finger / Both control modes): analog axes in -1…1
    this.steerX     = 0;
    this.throttleY  = 0;
    this.joystick   = null;        // { ox, oy, x, y } in canvas coordinates while dragging
    this._joyPointer = null;
    this.controlMode = 'buttons';  // 'buttons' | 'touch' | 'both' (set by the game)

    this._bindMobileButtons();
    this._bindTouchJoystick();
  }

  // Reset directional flags whenever the page loses focus so keys/touches
  // don't get stuck in the "pressed" state after a focus-loss event.
  _resetMovement() {
    this.left  = false;
    this.right = false;
    this.down  = false;
    this.up    = false;
    this.steerX = 0;
    this.throttleY = 0;
    this.joystick = null;
    this._joyPointer = null;
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': this.left    = true;  break;
      case 'ArrowRight': case 'KeyD': this.right   = true;  break;
      case 'ArrowDown':  case 'KeyS': this.down    = true;  break;
      case 'ArrowUp':    case 'KeyW': this.up      = true;  break;
      case 'KeyR': case 'Escape':     this.restart = true;  break;
    }
    if (e.key === '#') this._debugToggle = true;
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': this.left    = false; break;
      case 'ArrowRight': case 'KeyD': this.right   = false; break;
      case 'ArrowDown':  case 'KeyS': this.down    = false; break;
      case 'ArrowUp':    case 'KeyW': this.up      = false; break;
      case 'KeyR': case 'Escape':     this.restart = false; break;
    }
    if (e.key === '#') this._debugToggle = false;
  }

  _bindMobileButtons() {
    const bind = (id, flag) => {
      const el = document.getElementById(id);
      if (!el) return;

      // Track active pointer IDs so two simultaneous touches on the same
      // button don't cause a premature release when only one lifts.
      const activePointers = new Set();

      const press = (e) => {
        e.preventDefault();
        // Capture the pointer so pointerup/pointercancel always fires on
        // this element even if the finger slides off it mid-hold.
        el.setPointerCapture(e.pointerId);
        activePointers.add(e.pointerId);
        this[flag] = true;
        el.classList.add('pressed');
        if (window.MarbleNative) window.MarbleNative.lightImpact();
      };

      const release = (e) => {
        e.preventDefault();
        activePointers.delete(e.pointerId);
        if (activePointers.size === 0) {
          this[flag] = false;
          el.classList.remove('pressed');
        }
      };

      el.addEventListener('pointerdown',   press);
      el.addEventListener('pointerup',     release);
      el.addEventListener('pointercancel', release);
    };
    bind('btn-left',  'left');
    bind('btn-right', 'right');
    bind('btn-down',  'down');
    bind('btn-up',    'up');
  }

  setControlMode(mode) {
    this.controlMode = (mode === 'touch' || mode === 'both') ? mode : 'buttons';
    if (this.controlMode === 'buttons') this._endJoystick();
  }

  // Drag anywhere on the playfield: left/right steers, up brakes, down boosts.
  // The touch point is the joystick centre; JOY_RANGE screen pixels of drag is
  // full deflection, a small dead zone keeps a resting thumb neutral.
  _bindTouchJoystick() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const JOY_RANGE = 55;    // px on screen for full deflection
    const DEAD      = 0.12;  // fraction of the range ignored around the centre
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (canvas.width / (r.width || 1)),
        y: (e.clientY - r.top) * (canvas.height / (r.height || 1)),
        scale: canvas.width / (r.width || 1),
      };
    };
    const axis = (d) => {
      const v = Math.max(-1, Math.min(1, d / JOY_RANGE));
      if (Math.abs(v) < DEAD) return 0;
      return Math.sign(v) * (Math.abs(v) - DEAD) / (1 - DEAD);
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (this.controlMode === 'buttons' || this._joyPointer !== null) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      this._joyPointer = e.pointerId;
      this._joyStart = { x: e.clientX, y: e.clientY };
      const p = toCanvas(e);
      this.joystick = { ox: p.x, oy: p.y, x: p.x, y: p.y, range: JOY_RANGE * p.scale };
      this.steerX = this.throttleY = 0;
      if (window.MarbleNative) window.MarbleNative.lightImpact();
    }, { passive: false });

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._joyPointer || !this._joyStart) return;
      e.preventDefault();
      const dx = e.clientX - this._joyStart.x;
      const dy = e.clientY - this._joyStart.y;
      this.steerX    = axis(dx);
      this.throttleY = axis(dy);
      const p = toCanvas(e);
      const j = this.joystick;
      if (j) {
        // knob position clamped to the ring
        const ddx = p.x - j.ox, ddy = p.y - j.oy;
        const len = Math.hypot(ddx, ddy) || 1;
        const k = Math.min(1, j.range / len);
        j.x = j.ox + ddx * k;
        j.y = j.oy + ddy * k;
      }
    }, { passive: false });

    const end = (e) => {
      if (e.pointerId !== this._joyPointer) return;
      this._endJoystick();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  _endJoystick() {
    this._joyPointer = null;
    this._joyStart = null;
    this.joystick = null;
    this.steerX = 0;
    this.throttleY = 0;
  }

  // Consume the restart flag so it fires once per press
  consumeRestart() {
    const v = this.restart;
    this.restart = false;
    return v;
  }

  // Consume the debug-toggle flag so it fires once per press
  consumeDebugToggle() {
    const v = this._debugToggle;
    this._debugToggle = false;
    return v;
  }

  destroy() {
    window.removeEventListener('keydown',          this._onKeyDown);
    window.removeEventListener('keyup',            this._onKeyUp);
    window.removeEventListener('blur',             this._onBlur);
    document.removeEventListener('visibilitychange', this._onBlur);
  }
}
