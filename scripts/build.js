#!/usr/bin/env node
// Build script: assembles the dist/ directory for GitHub Pages / release.
// Produces: dist/index.html, dist/game.html, dist/perk-library.html, dist/showcase.html

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const pkg     = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version || '0.0.0';

// ── helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copy(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function write(dest, content) {
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content, 'utf8');
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// ── stamp build number into HTML ───────────────────────────────────────────

const buildNumber = process.env.BUILD_NUMBER || '0';

function stampedHtml(srcPath) {
  let html = fs.readFileSync(srcPath, 'utf8');
  // Replace version placeholder with version from package.json
  html = html.replace(/v\d+\.\d+(?:\.\d+)?/, `v${version}`);
  // Inject a hidden build-number meta tag just before </head>
  html = html.replace(
    '</head>',
    `  <meta name="build-number" content="${buildNumber}" />\n</head>`
  );
  return html;
}

// ── clean dist ─────────────────────────────────────────────────────────────

if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
ensureDir(DIST);

// ── copy static assets ─────────────────────────────────────────────────────

copy(path.join(ROOT, 'style.css'),            path.join(DIST, 'style.css'));
copyDir(path.join(ROOT, 'sounds'), path.join(DIST, 'sounds'));
copyDir(path.join(ROOT, 'js'), path.join(DIST, 'js'));

// ── index.html ─────────────────────────────────────────────────────────────

write(path.join(DIST, 'index.html'), stampedHtml(path.join(ROOT, 'index.html')));

// ── game.html  (canonical game page – same as index) ──────────────────────

write(path.join(DIST, 'game.html'), stampedHtml(path.join(ROOT, 'index.html')));

// ── perk-library.html ──────────────────────────────────────────────────────

write(path.join(DIST, 'perk-library.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="build-number" content="${buildNumber}" />
  <title>Perk Library – Marble Rush</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    body { max-width: 640px; margin: 2rem auto; font-family: sans-serif; padding: 0 1rem; }
    h1   { text-align: center; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: .5rem 1rem; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
  <h1>Perk Library</h1>
  <table>
    <thead>
      <tr><th>Icon</th><th>Name</th><th>Effect</th></tr>
    </thead>
    <tbody>
      <tr><td>⚡</td><td>Speed Boost</td><td>Temporarily increases marble top speed.</td></tr>
      <tr><td>▶▶</td><td>Dash</td><td>Instant forward burst of speed.</td></tr>
      <tr><td>❄</td><td>Bar Slow</td><td>Slows the fog-bar advance for a few seconds.</td></tr>
      <tr><td>◆</td><td>Shield</td><td>Absorbs one obstacle collision.</td></tr>
      <tr><td>👻</td><td>Ghost</td><td>Pass through obstacles briefly.</td></tr>
    </tbody>
  </table>
  <p style="text-align:center;margin-top:1.5rem;"><a href="game.html">▶ Play the game</a></p>
</body>
</html>
`);

// ── showcase.html ──────────────────────────────────────────────────────────

write(path.join(DIST, 'showcase.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="build-number" content="${buildNumber}" />
  <title>Showcase – Marble Rush</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    body { max-width: 680px; margin: 2rem auto; font-family: sans-serif; padding: 0 1rem; }
    h1   { text-align: center; }
    .card { border: 1px solid #ccc; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    .card h2 { margin-top: 0; }
  </style>
</head>
<body>
  <h1>Marble Rush – Showcase</h1>
  <div class="card">
    <h2>Procedural Track Generation</h2>
    <p>Every run generates a unique, infinitely-scrolling track with randomised curves and widths.</p>
  </div>
  <div class="card">
    <h2>Fog-of-Doom Mechanic</h2>
    <p>A creeping fog bar closes in as you slow down – keep your speed up or get swallowed!</p>
  </div>
  <div class="card">
    <h2>Pick-up System</h2>
    <p>Collect speed boosts, dashes, shields, and ghost perks scattered along the track.</p>
  </div>
  <div class="card">
    <h2>Mobile Support</h2>
    <p>On-screen touch controls let you steer and boost on any device.</p>
  </div>
  <p style="text-align:center;margin-top:1.5rem;"><a href="game.html">▶ Play now</a></p>
</body>
</html>
`);

console.log(`Build ${buildNumber} written to dist/`);
console.log('  dist/index.html');
console.log('  dist/game.html');
console.log('  dist/perk-library.html');
console.log('  dist/showcase.html');
console.log('  dist/style.css');
console.log('  dist/sounds/  (' + fs.readdirSync(path.join(ROOT, 'sounds')).length + ' tracks)');
const jsDir = path.join(DIST, 'js');
const jsCount = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).length : 0;
console.log('  dist/js/  (' + jsCount + ' files)');
