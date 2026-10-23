#!/usr/bin/env node
// Checks that all game scripts only use JavaScript up to ES2019.
// Older Android System WebViews (Chrome 74, e.g. Android 10 without updates)
// cannot parse newer syntax such as `?.` or `??`; a single such token makes the
// whole script fail and the game shows a black screen.
// Needs `acorn` (CI: npm install --no-save acorn@8).
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const JS_DIR = path.resolve(__dirname, '..', 'js');
let failed = 0;
for (const f of fs.readdirSync(JS_DIR).filter((n) => n.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  try {
    acorn.parse(src, { ecmaVersion: 2019, sourceType: 'script' });
    console.log(`  ✓ js/${f}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ js/${f}: ${e.message} – syntax newer than ES2019 breaks older Android WebViews`);
  }
}
console.log(`\nSyntax check (ES2019): ${failed === 0 ? 'OK' : failed + ' file(s) failed'}`);
process.exit(failed ? 1 : 0);
