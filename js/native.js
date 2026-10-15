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
      Haptics.impact({ style: 'LIGHT' }).catch(() => {});
    }

    heavyImpact() {
      if (!Haptics || typeof Haptics.impact !== 'function') return;
      Haptics.impact({ style: 'HEAVY' }).catch(() => {});
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
      App.addListener('backButton', () => {
        if (this._game && typeof this._game.handleBackButton === 'function') {
          const consumed = this._game.handleBackButton();
          if (consumed) return;
        }
        if (App.exitApp) App.exitApp();
      }).catch(() => {});
    }

    _hideStatusBar() {
      if (!this._isNative || !StatusBar || typeof StatusBar.hide !== 'function') return;
      StatusBar.hide().catch(() => {});
    }

    _showStatusBar() {
      if (!this._isNative || !StatusBar || typeof StatusBar.show !== 'function') return;
      StatusBar.show().catch(() => {});
    }
  }

  window.MarbleNative = new MarbleNativeBridge();
})();
