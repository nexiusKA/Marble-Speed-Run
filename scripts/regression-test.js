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

// ── summary ───────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
