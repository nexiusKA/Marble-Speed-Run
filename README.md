# Marble Rush

Vanilla JS canvas speed-run game.

## Commands

- `npm run test:regression` — regression checks
- `npm run build` — builds web output into `dist/`
- `npm run cap:sync:android` — rebuild web assets and sync to Android project
- `npm run android:bundle` — build Android release AAB from `android/`

## Android / Google Play

This repository is configured with Capacitor for Android release builds.

- App package id: `com.nexiuska.marblerush`
- App version: `1.0.0`
- Android project: `/home/runner/work/Marble-Speed-Run/Marble-Speed-Run/android`
- Privacy policy page: `/privacy-policy.html`
- Play Store assets: `/play-store-assets`

### Generate Android app resources

1. Update files in `/resources`:
   - `icon.png`
   - `icon-foreground.png`
   - `icon-background.png`
   - `splash.png`
2. Run:
   - `npx @capacitor/assets generate --android`

### Signed AAB workflow

Workflow: `.github/workflows/android-release.yml`

Required repository secrets:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

On `v*` tags, CI builds and uploads `app-release.aab`.
