const _meta = (name) => {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? (el.content || '').trim() : '';
};

const NATIVE_CONFIG = {
  sentryDsn: _meta('sentry-dsn'),
  revenueCatApiKeyAndroid: _meta('revenuecat-api-key-android'),
  revenueCatProducts: {
    void_push: 'void_push_pack',
    magnet: 'magnet_pack',
  },
  analyticsEnabled: true,
  monetizationEnabled: false,
};
