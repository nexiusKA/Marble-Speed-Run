# Marble Rush

Vanilla JS canvas speed-run game.

## Commands

- `npm test` — regression checks + build + browser tests
- `npm run test:regression` — static regression checks
- `npm run test:e2e` — headless-Chromium gameplay tests on `dist/` (needs `playwright`: `npm install --no-save playwright && npx playwright install chromium`)
- `npm run build` — builds web output into `dist/`
- `npm run cap:sync:android` — rebuild web assets and sync to Android project
- `npm run android:bundle` — build Android release AAB from `android/`

## Android / Google Play

This repository is configured with Capacitor for Android release builds.

- App package id: `com.nexiuska.marblerush`
- App version (`versionName`): taken from `package.json`
- Build number (`versionCode`): taken from `BUILD_NUMBER` (the CI run number) — must increase with every Play upload
- Android project: `android/`
- Privacy policy page: `privacy-policy.html` (published via GitHub Pages)
- Play Store assets: `play-store-assets/`
- No analytics, crash reporting, ads or in-app purchases — the app collects no data

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

### Releasing a new version

1. Bump `version` in `package.json` (e.g. `1.0.1`).
2. Commit, then tag with the same version: `git tag v1.0.1 && git push origin v1.0.1`.
3. CI checks that the tag matches `package.json`, runs all tests (including the
   privacy-policy release check), and uploads `app-release.aab` as a build artifact.
4. Upload the AAB in the Play Console.
