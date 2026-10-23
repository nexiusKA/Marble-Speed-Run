#!/usr/bin/env node
// ── Performance tests ────────────────────────────────────────────────────────
// Loads the built game (dist/) in headless Chromium and checks performance
// budgets. Most checks use hardware-independent numbers (draw calls, glow draws,
// gradients created per frame, list sizes) so they are stable on any CI
// machine; time-based checks only catch large regressions.
//
// Run:  npm run build && npm run test:perf
// Prints a real-time FPS estimate with 4× CPU throttling (≈ mid-range phone)
// for information.

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '..', 'dist');

// Per-frame budgets (average over 300 frames). Measured values at the time
// these were set are in the comments; budgets leave ~30 % headroom.
const BUDGETS = {
  menu:    { draws: 120, glowDraws: 45,  gradients: 6  }, // 88 / 33 / 4
  endless: { draws: 240, glowDraws: 110, gradients: 16 }, // 177 / 83 / 12
  rush:    { draws: 180, glowDraws: 30,  gradients: 12 }, // 131 / 21 / 9
  pvp10:   { draws: 320, glowDraws: 115, gradients: 24 }, // 239 / 87 / 18
};
const MAX_UPDATE_MS = 2;    // avg game.update() time, unthrottled (≈0.2 ms today)
const MAX_RENDER_MS = 30;   // avg game.render() incl. raster flush, unthrottled
const MAX_LIST_LEN  = 200;  // no game list may grow beyond this in a long run

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let passed = 0;
let failed = 0;
const lines = [];
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function test(name, fn) {
  try { await fn(); passed++; lines.push(`  ✓ ${name}`); }
  catch (e) { failed++; lines.push(`  ✗ ${name}\n      ${e.message}`); }
}

async function newPage(browser, baseUrl, init) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.waitForFunction(() => !!window.__marbleGame);
  return page;
}

// Instrument the game's canvas context and measure one scene.
async function measureScene(page, setup, glowScale) {
  return page.evaluate(({ setup, glowScale }) => {
    const g = window.__marbleGame;
    const P = CanvasRenderingContext2D.prototype;
    if (!window.__perfHooked) {
      window.__perfHooked = true;
      window.__cnt = { draws: 0, glowDraws: 0, gradients: 0 };
      const blurDesc = Object.getOwnPropertyDescriptor(P, 'shadowBlur');
      for (const m of ['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage']) {
        const orig = P[m];
        P[m] = function (...a) {
          if (this === g.ctx) {
            window.__cnt.draws++;
            if (blurDesc.get.call(this) > 0) window.__cnt.glowDraws++;
          }
          return orig.apply(this, a);
        };
      }
      for (const m of ['createLinearGradient', 'createRadialGradient']) {
        const orig = P[m];
        P[m] = function (...a) { if (this === g.ctx) window.__cnt.gradients++; return orig.apply(this, a); };
      }
    }
    g.quality.glowScale = glowScale;
    (new Function('g', setup))(g);
    for (let i = 0; i < 240; i++) { g.shieldTimer = 2; g.update(1 / 60); if (g.state === 'shop') g.closeShop(); }

    const N = 300;
    const c = window.__cnt; c.draws = c.glowDraws = c.gradients = 0;
    let upd = 0, ren = 0;
    for (let i = 0; i < N; i++) {
      if (i % 30 === 0) { const x = Math.random(); g.input.left = x < 0.35; g.input.right = x > 0.65; }
      g.shieldTimer = 2;
      const t0 = performance.now(); g.update(1 / 60);
      const t1 = performance.now(); g.render(); g.ctx.getImageData(0, 0, 1, 1);
      const t2 = performance.now();
      upd += t1 - t0; ren += t2 - t1;
      if (g.state === 'shop') g.closeShop();
    }
    g.input.left = g.input.right = false;
    return {
      draws: c.draws / N, glowDraws: c.glowDraws / N, gradients: c.gradients / N,
      updateMs: upd / N, renderMs: ren / N, state: g.state, rush: !!g.powerRushActive,
    };
  }, { setup, glowScale });
}

const SCENES = {
  menu:    "g.state = 'menu';",
  endless: 'g.startRun();',
  rush:    "g.startRun(); for (let i = 0; i < 300; i++) g.update(1/60); g.nextPowerRushDist = g.distance + 5;" +
           "for (let i = 0; i < 300 && !g.powerRushActive; i++) { g.shieldTimer = 5; g.update(1/60); }" +
           "if (g.state === 'shop') g.closeShop();",
  pvp10:   'g._pvpEnemyCount = 10; g.startPvpRun();',
};

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ not found – run `npm run build` first.');
    process.exit(1);
  }
  const server  = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  console.log('\nMarble Rush – performance tests\n');

  // 1. Draw-call / glow / gradient budgets per scene (full quality)
  const page = await newPage(browser, baseUrl);
  const results = {};
  for (const [name, setup] of Object.entries(SCENES)) {
    results[name] = await measureScene(page, setup, 1);
  }
  for (const [name, r] of Object.entries(results)) {
    const b = BUDGETS[name];
    await test(`${name}: draw calls per frame within budget (${r.draws.toFixed(0)} ≤ ${b.draws})`, async () => {
      assert(r.draws <= b.draws, `${r.draws.toFixed(1)} draw calls per frame, budget ${b.draws}`);
    });
    await test(`${name}: glow draws per frame within budget (${r.glowDraws.toFixed(0)} ≤ ${b.glowDraws})`, async () => {
      assert(r.glowDraws <= b.glowDraws, `${r.glowDraws.toFixed(1)} draws with shadowBlur per frame, budget ${b.glowDraws}`);
    });
    await test(`${name}: gradients created per frame within budget (${r.gradients.toFixed(1)} ≤ ${b.gradients})`, async () => {
      assert(r.gradients <= b.gradients, `${r.gradients.toFixed(1)} gradients per frame, budget ${b.gradients}`);
    });
  }
  await test('Power Rush scene actually reached Power Rush', async () => {
    assert(results.rush.rush, 'Power Rush was not active during the rush measurement');
  });

  // 2. Low quality removes all glow
  const low = {};
  for (const [name, setup] of Object.entries(SCENES)) low[name] = await measureScene(page, setup, 0);
  await test('low quality: no shadowBlur draws in any scene', async () => {
    const bad = Object.entries(low).filter(([, r]) => r.glowDraws > 0).map(([n, r]) => `${n}: ${r.glowDraws}`);
    assert(bad.length === 0, `glow draws remain in low quality – ${bad.join(', ')}`);
  });

  // 3. Time budgets (only catch big regressions; absolute numbers depend on the machine)
  await test(`game logic: update() avg below ${MAX_UPDATE_MS} ms in every scene`, async () => {
    const bad = Object.entries(results).filter(([, r]) => r.updateMs > MAX_UPDATE_MS);
    assert(bad.length === 0, bad.map(([n, r]) => `${n}: ${r.updateMs.toFixed(2)} ms`).join(', '));
  });
  await test(`rendering: render() avg below ${MAX_RENDER_MS} ms in every scene`, async () => {
    const bad = Object.entries(results).filter(([, r]) => r.renderMs > MAX_RENDER_MS);
    assert(bad.length === 0, bad.map(([n, r]) => `${n}: ${r.renderMs.toFixed(1)} ms`).join(', '));
  });
  await page.context().close();

  // 4. No unbounded growth over a long session
  await test(`long session (10 min endless + 3 min PvP): no list grows beyond ${MAX_LIST_LEN}`, async () => {
    const p = await newPage(browser, baseUrl);
    const sizes = await p.evaluate((MAX) => {
      const g = window.__marbleGame;
      const maxSeen = {};
      const snap = () => {
        const visit = (obj, prefix) => {
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            const n = Array.isArray(v) ? v.length : (v instanceof Map || v instanceof Set) ? v.size : -1;
            if (n >= 0) maxSeen[prefix + k] = Math.max(maxSeen[prefix + k] || 0, n);
          }
        };
        visit(g, ''); if (g.track) visit(g.track, 'track.');
      };
      const run = (frames) => {
        for (let i = 0; i < frames; i++) {
          if (i % 30 === 0) { const x = Math.random(); g.input.left = x < 0.35; g.input.right = x > 0.65; }
          g.shieldTimer = 2; g.update(1 / 60);
          if (i % 20 === 0) { g.render(); snap(); }
          if (g.state === 'shop') g.closeShop();
        }
      };
      g.startRun(); run(60 * 60 * 10);
      g._pvpEnemyCount = 10; g.startPvpRun(); run(60 * 60 * 3);
      return Object.entries(maxSeen).filter(([, n]) => n > MAX);
    }, MAX_LIST_LEN);
    await p.context().close();
    assert(sizes.length === 0, `lists grew too large: ${sizes.map(([k, n]) => `${k}=${n}`).join(', ')}`);
  });

  // 5. Adaptive quality
  await test('auto quality: slow device (30 fps) switches to low and remembers it', async () => {
    const p = await newPage(browser, baseUrl);
    const r = await p.evaluate(() => {
      const q = window.__marbleGame.quality;
      for (let i = 0; i < 200; i++) q.sample(1 / 30, true);
      return { scale: q.glowScale, stored: localStorage.getItem('mrFxQuality') };
    });
    assert(r.scale === 0, `glowScale is ${r.scale}, expected 0`);
    assert(r.stored === 'auto-low', `stored setting is ${r.stored}`);
    await p.reload();
    await p.waitForFunction(() => !!window.__marbleGame);
    const after = await p.evaluate(() => window.__marbleGame.quality.glowScale);
    await p.context().close();
    assert(after === 0, 'low quality was not restored after restart');
  });

  await test('auto quality: fast device (60 fps) keeps full glow; pauses are ignored', async () => {
    const p = await newPage(browser, baseUrl);
    const r = await p.evaluate(() => {
      const q = window.__marbleGame.quality;
      for (let i = 0; i < 100; i++) q.sample(1, true);          // tab-switch gaps: ignored
      for (let i = 0; i < 200; i++) q.sample(1 / 30, false);    // not playing (menu): ignored
      for (let i = 0; i < 200; i++) q.sample(1 / 60, true);
      return { scale: q.glowScale, stored: localStorage.getItem('mrFxQuality') };
    });
    await p.context().close();
    assert(r.scale === 1, `glowScale is ${r.scale}, expected 1`);
    assert(r.stored === null, `unexpected stored setting ${r.stored}`);
  });

  // 6. Info: real-time frame rate with 4× CPU throttling (≈ mid-range phone)
  const info = {};
  for (const [label, glow] of [['full glow', 1], ['low quality', 0]]) {
    const p = await newPage(browser, baseUrl);
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    info[label] = await p.evaluate((glow) => new Promise((resolve) => {
      const g = window.__marbleGame;
      g.quality.mode = 'high'; g.quality.glowScale = glow;
      document.getElementById('overlay').classList.replace('visible', 'hidden');
      g.startRun();
      const ts = []; const t0 = performance.now();
      const tick = (t) => {
        ts.push(t); g.shieldTimer = 2; if (g.state === 'shop') g.closeShop();
        if (t - t0 < 6000) requestAnimationFrame(tick);
        else {
          const d = ts.slice(1).map((x, i) => x - ts[i]);
          resolve({ fps: Math.round(1000 * d.length / (ts[ts.length - 1] - ts[0])), long: d.filter((x) => x > 33).length });
        }
      };
      requestAnimationFrame(tick);
    }), glow);
    await p.context().close();
  }

  await browser.close();
  server.close();

  console.log(lines.join('\n'));
  console.log('\n  Per-frame numbers (full quality):');
  for (const [n, r] of Object.entries(results)) {
    console.log(`    ${n.padEnd(8)} draws ${r.draws.toFixed(0).padStart(4)}  glow ${r.glowDraws.toFixed(0).padStart(4)}  gradients ${r.gradients.toFixed(1).padStart(5)}  update ${r.updateMs.toFixed(2)} ms  render ${r.renderMs.toFixed(1)} ms`);
  }
  console.log('\n  Info – real time with 4× CPU throttling (software rendering, no GPU):');
  for (const [k, v] of Object.entries(info)) console.log(`    ${k.padEnd(12)} ~${v.fps} fps, ${v.long} frames > 33 ms in 6 s`);
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
