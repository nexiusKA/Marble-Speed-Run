// ── native.js ────────────────────────────────────────────────────────────────
// Thin bridge to the Capacitor plugins used by the Android build:
// back button (App), haptics, status bar and screen wake lock.
// Every call is a safe no-op in a normal browser.
(function initMarbleNative() {
  const cap = window.Capacitor;
  const plugins = cap && cap.Plugins ? cap.Plugins : {};

  const App = plugins.App;
  const Haptics = plugins.Haptics;
  const StatusBar = plugins.StatusBar;

  // Call a plugin method and swallow errors, whether it returns a Promise or not.
  const safe = (fn) => {
    try { Promise.resolve(fn()).catch(() => {}); } catch (_) { /* ignore */ }
  };

  class MarbleNativeBridge {
    constructor() {
      this._game = null;
      this._wakeLock = null;
      this._isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
      this._lastState = null;
      this._init();
    }

    _init() {
      this._initBackButtonHandler();
      this._initAppLifecycle();
      this._hideStatusBar();

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.releaseWakeLock();
          this._showStatusBar();
        } else {
          if (this._lastState === 'running') this.acquireWakeLock();
          this._hideStatusBar();
        }
      });
    }

    setGame(game) {
      this._game = game;
    }

    onGameStateChange(state) {
      this._lastState = state;
      if (state === 'running') {
        this.acquireWakeLock();
        this._hideStatusBar();
      } else {
        this.releaseWakeLock();
        if (state !== 'countdown') this._showStatusBar();
      }
    }

    lightImpact() {
      if (!Haptics || typeof Haptics.impact !== 'function') return;
      safe(() => Haptics.impact({ style: 'LIGHT' }));
    }

    heavyImpact() {
      if (!Haptics || typeof Haptics.impact !== 'function') return;
      safe(() => Haptics.impact({ style: 'HEAVY' }));
    }

    async acquireWakeLock() {
      if (!navigator.wakeLock || this._wakeLock || document.hidden) return;
      try {
        this._wakeLock = await navigator.wakeLock.request('screen');
        this._wakeLock.addEventListener('release', () => {
          this._wakeLock = null;
        });
      } catch (_) {
        this._wakeLock = null;
      }
    }

    releaseWakeLock() {
      if (!this._wakeLock) return;
      this._wakeLock.release().catch(() => {});
      this._wakeLock = null;
    }

    _initBackButtonHandler() {
      if (!this._isNative || !App || typeof App.addListener !== 'function') return;
      // Capacitor 8 returns a listener handle that is not always a Promise,
      // so never chain .catch() directly on addListener().
      try {
        const handle = App.addListener('backButton', () => {
          if (this._game && typeof this._game.handleBackButton === 'function') {
            const consumed = this._game.handleBackButton();
            if (consumed) return;
          }
          if (App.exitApp) App.exitApp();
        });
        Promise.resolve(handle).catch(() => {});
      } catch (_) { /* back button falls back to default behaviour */ }
    }

    // Android: the app going to the background (home button, app switcher,
    // screen off, phone call) is reported by Capacitor's App plugin. The
    // WebView alone does not reliably fire visibilitychange, which is why the
    // music kept playing in the background.
    _initAppLifecycle() {
      if (!this._isNative || !App || typeof App.addListener !== 'function') return;
      const hidden  = () => { if (this._game && this._game.onAppHidden) this._game.onAppHidden(); };
      const visible = () => { if (this._game && this._game.onAppVisible) this._game.onAppVisible(); };
      const listen = (event, fn) => {
        try { Promise.resolve(App.addListener(event, fn)).catch(() => {}); } catch (_) { /* ignore */ }
      };
      listen('pause', hidden);
      listen('resume', visible);
      listen('appStateChange', (state) => {
        if (state && state.isActive === false) hidden();
        else if (state && state.isActive) visible();
      });
    }

    _hideStatusBar() {
      if (!this._isNative || !StatusBar || typeof StatusBar.hide !== 'function') return;
      safe(() => StatusBar.hide());
    }

    _showStatusBar() {
      if (!this._isNative || !StatusBar || typeof StatusBar.show !== 'function') return;
      safe(() => StatusBar.show());
    }
  }

  window.MarbleNative = new MarbleNativeBridge();
})();
