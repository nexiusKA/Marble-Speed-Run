#!/usr/bin/env node
// Regression tests: basic smoke-tests for the Marble Rush source files.
// Uses only Node.js built-ins – no test framework required.

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  ✓', message);
    passed++;
  } else {
    console.error('  ✗', message);
    failed++;
  }
}

function assertFileExists(relPath) {
  const abs = path.join(ROOT, relPath);
  assert(fs.existsSync(abs), `File exists: ${relPath}`);
}

function assertFileContains(relPath, pattern, description) {
  const abs        = path.join(ROOT, relPath);
  const text       = fs.readFileSync(abs, 'utf8');
  const ok         = pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern);
  const patternStr = pattern instanceof RegExp ? pattern.source : pattern;
  assert(ok, description || `${relPath} contains ${patternStr}`);
}

// ── 1. Required source files ───────────────────────────────────────────────

console.log('\n[1] Required source files');
for (const f of [
  'index.html',
  'style.css',
  'js/utils.js',
  'js/input.js',
  'js/marble.js',
  'js/obstacle.js',
  'js/track.js',
  'js/fog.js',
  'js/pickup.js',
  'js/ui.js',
  'js/game.js',
  'js/main.js',
]) {
  assertFileExists(f);
}

// ── 2. index.html structure ────────────────────────────────────────────────

console.log('\n[2] index.html structure');
assertFileContains('index.html', '<canvas id="gameCanvas">', 'canvas element present');
assertFileContains('index.html', 'js/main.js',               'main.js is loaded');
assertFileContains('index.html', 'js/game.js',               'game.js is loaded');
assertFileContains('index.html', 'style.css',                'stylesheet linked');

// ── 3. Core utility functions in utils.js ─────────────────────────────────

console.log('\n[3] utils.js – core helpers');
assertFileContains('js/utils.js', /function clamp/,            'clamp() defined');
assertFileContains('js/utils.js', /function lerp/,             'lerp() defined');
assertFileContains('js/utils.js', /function dist/,             'dist() defined');

// ── 4. Game state constants in game.js ────────────────────────────────────

console.log('\n[4] game.js – constants & class');
assertFileContains('js/game.js', /const STATE\s*=/,            'STATE constant defined');
assertFileContains('js/game.js', /class Game/,                 'Game class defined');

// ── 5. Package.json integrity ─────────────────────────────────────────────

console.log('\n[5] package.json integrity');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert(pkg.name === 'marble-speed-run',    'package name is marble-speed-run');
assert(typeof pkg.scripts.build === 'string',          'build script defined');
assert(typeof pkg.scripts['test:regression'] === 'string', 'test:regression script defined');

// ── 6. Android release config ─────────────────────────────────────────────

console.log('\n[6] Android release config');
const gradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8');
assert(/versionCode appVersionCode/.test(gradle), 'versionCode comes from the CI build number');
assert(/versionName appVersionName/.test(gradle), 'versionName comes from package.json');
assert(!/^\s*(keyAlias|keyPassword|storePassword)\s+(keyAlias|keyPassword|storePassword)\s*$/m.test(gradle),
  'signingConfig does not call a same-named variable (Groovy String.call() error)');
const allDeps = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));
const bannedSdks = ['@capacitor-firebase/analytics', '@sentry/capacitor', '@revenuecat/purchases-capacitor'];
assert(!allDeps.some(d => bannedSdks.includes(d)),
  'no analytics / crash-reporting / IAP SDKs (privacy policy says no data is collected)');

const capCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'));
assert(capCfg.server && capCfg.server.errorPath && fs.existsSync(path.join(ROOT, capCfg.server.errorPath)),
  'Capacitor errorPath page exists (shown instead of a white screen on outdated WebViews)');
const nativeJs = fs.readFileSync(path.join(ROOT, 'js/native.js'), 'utf8');
// find the end of every addListener( … ) call and make sure no .catch follows it
const chainsCatchOnAddListener = (src) => {
  let i = 0;
  while ((i = src.indexOf('addListener(', i)) !== -1) {
    let depth = 0, j = i + 'addListener'.length;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')' && --depth === 0) break;
    }
    if (/^\s*\.catch/.test(src.slice(j + 1))) return true;
    i = j;
  }
  return false;
};
assert(!chainsCatchOnAddListener(nativeJs),
  'native.js does not chain .catch() on App.addListener() (crashes on Capacitor 8)');

assert(capCfg.android && capCfg.android.minWebViewVersion >= 87,
  'android.minWebViewVersion >= 87 (older WebViews crash or break the layout -> update page instead)');

const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
assert(/html,\s*body\s*\{[^}]*overflow:\s*hidden/.test(css) && /touch-action:\s*manipulation/.test(css),
  'page cannot scroll or double-tap zoom (html/body overflow hidden, touch-action manipulation)');
assert(capCfg.zoomEnabled === false, 'Capacitor zoomEnabled is false');
const mainActivity = fs.readFileSync(path.join(ROOT, 'android/app/src/main/java/com/nexiuska/marblerush/MainActivity.java'), 'utf8');
assert(/setSupportZoom\(false\)/.test(mainActivity) && /setTextZoom\(100\)/.test(mainActivity),
  'MainActivity disables WebView zoom and fixes text zoom at 100 %');

const manifest = fs.readFileSync(path.join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const gameModeCfgPath = path.join(ROOT, 'android/app/src/main/res/xml/game_mode_config.xml');
assert(/android\.game_mode_config/.test(manifest) && fs.existsSync(gameModeCfgPath) &&
  /allowGameDownscaling="false"/.test(fs.readFileSync(gameModeCfgPath, 'utf8')),
  'Game Mode downscaling disabled (Samsung Game Booster zoomed/cropped the WebView)');

// Music: every playlist entry is a real track, and every file in sounds/ is on the playlist
const soundSrc = fs.readFileSync(path.join(ROOT, 'js/sound.js'), 'utf8');
const playlist = (soundSrc.match(/const MUSIC_TRACKS = \[([\s\S]*?)\];/) || [, ''])[1]
  .match(/'sounds\/[^']+'/g).map((t) => t.slice(1, -1));
const soundFiles = fs.readdirSync(path.join(ROOT, 'sounds')).filter((f) => !f.startsWith('.'));
assert(playlist.length >= 2, `music playlist has several tracks (${playlist.length})`);
assert(playlist.every((t) => fs.existsSync(path.join(ROOT, t)) && fs.statSync(path.join(ROOT, t)).size > 500 * 1024),
  'every playlist track exists and is a real song (> 500 KB, no placeholder stub)');
assert(soundFiles.every((f) => playlist.includes('sounds/' + f)),
  'no unused files in sounds/ (they would bloat the app)');

// Release gate: only enforced with RELEASE_CHECK=1 (tag builds in CI)
if (process.env.RELEASE_CHECK === '1') {
  const policy = fs.readFileSync(path.join(ROOT, 'privacy-policy.html'), 'utf8');
  assert(!/PLACEHOLDER/.test(policy), 'privacy policy has real contact name and e-mail (no PLACEHOLDER left)');
}

// ── summary ───────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
