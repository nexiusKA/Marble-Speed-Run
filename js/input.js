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

    // Split-screen steering (Finger / Both control modes): a finger held on the
    // left half of the playfield is ◀, on the right half ▶; sliding it down is ▼
    // boost, up is ▲ slow. steerX / throttleY are -1, 0 or 1 – exactly like
    // holding a button.
    this.steerX     = 0;
    this.throttleY  = 0;
    this.zones      = { left: false, right: false }; // which half is held (for the glow)
    this._zoneTouches = new Map();  // touch / pointer id → { side, y0, slide }
    this.controlMode = 'buttons';   // 'buttons' | 'touch' | 'both' (set by the game)

    this._bindMobileButtons();
    this._bindTouchZones();
  }

  // Reset directional flags whenever the page loses focus so keys/touches
  // don't get stuck in the "pressed" state after a focus-loss event.
  _resetMovement() {
    this.left  = false;
    this.right = false;
    this.down  = false;
    this.up    = false;
    this._clearZones();
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
    if (this.controlMode === 'buttons') this._clearZones();
  }

  // Split-screen steering: hold a finger on the left half of the playfield for
  // ◀, on the right half for ▶ – the same as holding the button. Sliding a held
  // finger across the middle switches direction; fingers on both halves cancel
  // out; lifting all fingers stops steering.
  // Boost / slow: while holding, slide the finger down (▼ boost) or up (▲ slow)
  // by SLIDE_THRESHOLD px from where it touched down; back near that point is
  // neutral again. Steering keeps working while sliding.
  //
  // Fingers are read from Touch Events with preventDefault: on Android Chrome a
  // finger held still for ~1 s turns into a long-press (text selection /
  // context menu) and the browser cancels the *pointer* events – steering
  // stopped although the finger was still down. Cancelling touchstart/touchmove
  // suppresses those gestures. Pointer events are only used for the mouse.
  _bindTouchZones() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const SLIDE_THRESHOLD = 35;  // screen px up / down → ▲ slow / ▼ boost
    const active = () => this.controlMode !== 'buttons';
    const sideOf = (clientX) => {
      const r = canvas.getBoundingClientRect();
      return clientX < r.left + r.width / 2 ? 'left' : 'right';
    };
    const set = (id, clientX, clientY) => {
      let t = this._zoneTouches.get(id);
      const isNew = !t;
      if (isNew) { t = { side: null, y0: clientY, slide: 0 }; this._zoneTouches.set(id, t); }
      const dy = clientY - t.y0;
      const side = sideOf(clientX);
      const slide = dy >= SLIDE_THRESHOLD ? 1 : dy <= -SLIDE_THRESHOLD ? -1 : 0;
      if (t.side === side && t.slide === slide) return;
      t.side = side; t.slide = slide;
      this._updateZones();
      if (isNew && window.MarbleNative) window.MarbleNative.lightImpact();
    };
    const end = (id) => { if (this._zoneTouches.delete(id)) this._updateZones(); };

    // ── Touch (fingers) ──
    canvas.addEventListener('touchstart', (e) => {
      if (!active()) return;
      e.preventDefault();                       // no long-press, selection, scroll or zoom
      for (const t of e.changedTouches) set('t' + t.identifier, t.clientX, t.clientY);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (!active()) return;
      e.preventDefault();
      for (const t of e.changedTouches) if (this._zoneTouches.has('t' + t.identifier)) set('t' + t.identifier, t.clientX, t.clientY);
    }, { passive: false });
    const touchEnd = (e) => { for (const t of e.changedTouches) end('t' + t.identifier); };
    canvas.addEventListener('touchend', touchEnd);
    canvas.addEventListener('touchcancel', touchEnd);

    // ── Mouse / pen (pointer events; touch is handled above) ──
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || !active()) return;
      e.preventDefault();
      set('p' + e.pointerId, e.clientX, e.clientY);
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !this._zoneTouches.has('p' + e.pointerId)) return;
      set('p' + e.pointerId, e.clientX, e.clientY);
    });
    const pointerEnd = (e) => { if (e.pointerType !== 'touch') end('p' + e.pointerId); };
    canvas.addEventListener('pointerup', pointerEnd);
    canvas.addEventListener('pointercancel', pointerEnd);

    // Never open a context menu (long-press) over the game
    const container = document.getElementById('game-container') || canvas;
    container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _updateZones() {
    let left = false, right = false, boost = false, slow = false;
    for (const t of this._zoneTouches.values()) {
      if (t.side === 'left') left = true; else right = true;
      if (t.slide > 0) boost = true; else if (t.slide < 0) slow = true;
    }
    this.zones.left = left;
    this.zones.right = right;
    this.steerX = (right ? 1 : 0) - (left ? 1 : 0);
    this.throttleY = (boost ? 1 : 0) - (slow ? 1 : 0);
  }

  _clearZones() {
    this._zoneTouches.clear();
    this.zones.left = this.zones.right = false;
    this.steerX = 0;
    this.throttleY = 0;
  }

  // Called once per frame by the game (kept as a hook; split-screen steering is
  // button-like and needs no per-frame smoothing).
  update(_dt) {}

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
