(function initMarbleNative() {
  const cap = window.Capacitor;
  const plugins = cap && cap.Plugins ? cap.Plugins : {};

  const App = plugins.App;
  const Haptics = plugins.Haptics;
  const StatusBar = plugins.StatusBar;
  const FirebaseAnalytics = plugins.FirebaseAnalytics;
  const Purchases = plugins.Purchases;
  const SentryCapacitor = plugins.SentryCapacitor;

  const cfg = (typeof NATIVE_CONFIG === 'object' && NATIVE_CONFIG) || {};

  class MarbleNativeBridge {
    constructor() {
      this._game = null;
      this._wakeLock = null;
      this._isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
      this._analyticsEnabled = !!cfg.analyticsEnabled;
      this._monetizationEnabled = !!cfg.monetizationEnabled;
      this._lastState = null;
      this._init();
    }

    _init() {
      this._initCrashReporting();
      this._initAnalytics();
      this._initMonetization();
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

    trackEvent(name, params) {
      if (!this._analyticsEnabled || !FirebaseAnalytics || typeof FirebaseAnalytics.logEvent !== 'function') return;
      const clean = {};
      if (params && typeof params === 'object') {
        for (const [k, v] of Object.entries(params)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') clean[k] = v;
        }
      }
      FirebaseAnalytics.logEvent({ name, params: clean }).catch(() => {});
    }

    captureError(err, context) {
      if (!SentryCapacitor || typeof SentryCapacitor.captureException !== 'function') return;
      const message = err && err.message ? err.message : String(err);
      SentryCapacitor.captureException({ message, extra: context || {} }).catch(() => {});
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

    isMonetizationEnabled() {
      return this._monetizationEnabled;
    }

    async purchaseProduct(productId) {
      if (!this._monetizationEnabled || !Purchases || typeof Purchases.purchaseStoreProduct !== 'function') return false;
      try {
        const storeProductId = (cfg.revenueCatProducts && cfg.revenueCatProducts[productId]) || productId;
        await Purchases.purchaseStoreProduct({ productIdentifier: storeProductId });
        return true;
      } catch (_) {
        return false;
      }
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

    _initCrashReporting() {
      if (SentryCapacitor && typeof SentryCapacitor.init === 'function' && cfg.sentryDsn) {
        SentryCapacitor.init({
          dsn: cfg.sentryDsn,
          enabled: true,
          debug: false,
          tracesSampleRate: 0.05,
        }).catch(() => {});
      }

      window.addEventListener('error', (event) => {
        this.captureError(event.error || event.message, { type: 'window.error' });
      });
      window.addEventListener('unhandledrejection', (event) => {
        this.captureError(event.reason, { type: 'unhandledrejection' });
      });
    }

    _initAnalytics() {
      if (!this._analyticsEnabled || !FirebaseAnalytics) return;
      if (typeof FirebaseAnalytics.setEnabled === 'function') {
        FirebaseAnalytics.setEnabled({ enabled: true }).catch(() => {});
      }
    }

    _initMonetization() {
      if (!this._isNative || !this._monetizationEnabled || !Purchases || typeof Purchases.configure !== 'function') return;
      const apiKey = cfg.revenueCatApiKeyAndroid || '';
      if (!apiKey) return;
      Purchases.configure({ apiKey }).catch(() => {});
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
