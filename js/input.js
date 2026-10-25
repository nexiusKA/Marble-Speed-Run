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
    this._steerTarget = 0;
    this._throttleTarget = 0;
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
  //
  // Fingers are read from Touch Events with preventDefault: on Android Chrome a
  // finger held still for ~1 s turns into a long-press (text selection /
  // context menu) and the browser cancels the *pointer* events – the joystick
  // stopped although the finger was still down. Cancelling touchstart/touchmove
  // suppresses those gestures. Pointer events are only used for the mouse.
  _bindTouchJoystick() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const JOY_RANGE = 85;    // px on screen for full deflection (more travel = finer control)
    const DEAD      = 0.10;  // fraction of the range ignored around the centre
    const CURVE     = 1.6;   // response curve: gentle near the centre, full at the edge
    const toCanvas = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (clientX - r.left) * (canvas.width / (r.width || 1)),
        y: (clientY - r.top) * (canvas.height / (r.height || 1)),
        scale: canvas.width / (r.width || 1),
      };
    };
    const axis = (d) => {
      const v = Math.max(-1, Math.min(1, d / JOY_RANGE));
      if (Math.abs(v) < DEAD) return 0;
      const lin = (Math.abs(v) - DEAD) / (1 - DEAD);
      return Math.sign(v) * Math.pow(lin, CURVE);
    };
    const active = () => this.controlMode !== 'buttons';

    const start = (id, clientX, clientY) => {
      if (!active() || this._joyPointer !== null) return false;
      this._joyPointer = id;
      this._joyStart = { x: clientX, y: clientY };
      const p = toCanvas(clientX, clientY);
      this.joystick = { ox: p.x, oy: p.y, x: p.x, y: p.y, range: JOY_RANGE * p.scale,
                        t0: (typeof performance !== 'undefined' ? performance.now() : Date.now()) };
      this.steerX = this.throttleY = 0;
      this._steerTarget = this._throttleTarget = 0;
      if (window.MarbleNative) window.MarbleNative.lightImpact();
      return true;
    };
    const move = (id, clientX, clientY) => {
      if (id !== this._joyPointer || !this._joyStart) return;
      // targets – the values the marble uses ease towards them in update()
      this._steerTarget    = axis(clientX - this._joyStart.x);
      this._throttleTarget = axis(clientY - this._joyStart.y);
      const j = this.joystick;
      if (j) {
        const p = toCanvas(clientX, clientY);
        const ddx = p.x - j.ox, ddy = p.y - j.oy;
        const len = Math.hypot(ddx, ddy) || 1;
        const k = Math.min(1, j.range / len);
        j.x = j.ox + ddx * k;
        j.y = j.oy + ddy * k;
      }
    };
    const end = (id) => { if (id === this._joyPointer) this._endJoystick(); };

    // ── Touch (fingers) ──
    const findTouch = (list, id) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
      return null;
    };
    canvas.addEventListener('touchstart', (e) => {
      if (!active()) return;
      e.preventDefault();                       // no long-press, selection, scroll or zoom
      if (this._joyPointer !== null) return;    // a second finger does not take over
      const t = e.changedTouches[0];
      if (t) start('t' + t.identifier, t.clientX, t.clientY);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (!active()) return;
      e.preventDefault();
      if (typeof this._joyPointer !== 'string') return;
      const t = findTouch(e.touches, Number(this._joyPointer.slice(1)));
      if (t) move(this._joyPointer, t.clientX, t.clientY);
    }, { passive: false });
    const touchEnd = (e) => {
      if (typeof this._joyPointer !== 'string') return;
      if (findTouch(e.changedTouches, Number(this._joyPointer.slice(1)))) end(this._joyPointer);
    };
    canvas.addEventListener('touchend', touchEnd);
    canvas.addEventListener('touchcancel', touchEnd);

    // ── Mouse / pen (pointer events; touch is handled above) ──
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || !active()) return;
      e.preventDefault();
      if (start('p' + e.pointerId, e.clientX, e.clientY)) {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      move('p' + e.pointerId, e.clientX, e.clientY);
    });
    const pointerEnd = (e) => { if (e.pointerType !== 'touch') end('p' + e.pointerId); };
    canvas.addEventListener('pointerup', pointerEnd);
    canvas.addEventListener('pointercancel', pointerEnd);

    // Never open a context menu (long-press) over the game
    const container = document.getElementById('game-container') || canvas;
    container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _endJoystick() {
    this._joyPointer = null;
    this._joyStart = null;
    this.joystick = null;
    this.steerX = 0;
    this.throttleY = 0;
    this._steerTarget = 0;
    this._throttleTarget = 0;
  }

  // Called once per frame by the game: the joystick axes follow the finger
  // with a short time constant, so tiny finger jitter does not twitch the
  // marble. Releasing the finger stops immediately (see _endJoystick).
  update(dt) {
    if (this._joyPointer === null) return;
    const TAU = 0.09; // seconds
    const k = 1 - Math.exp(-Math.max(0, dt) / TAU);
    const ease = (cur, target) => {
      const v = cur + ((target || 0) - cur) * k;
      return Math.abs(v - (target || 0)) < 0.02 ? (target || 0) : v;
    };
    this.steerX    = ease(this.steerX, this._steerTarget);
    this.throttleY = ease(this.throttleY, this._throttleTarget);
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
