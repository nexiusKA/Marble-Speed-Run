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

    this._bindMobileButtons();
  }

  // Reset directional flags whenever the page loses focus so keys/touches
  // don't get stuck in the "pressed" state after a focus-loss event.
  _resetMovement() {
    this.left  = false;
    this.right = false;
    this.down  = false;
    this.up    = false;
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
