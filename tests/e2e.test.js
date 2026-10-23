#!/usr/bin/env node
// ── End-to-end browser tests ─────────────────────────────────────────────────
// Loads the built game (dist/) in headless Chromium and checks that it really
// runs: menu → countdown → run → game over → restart, PvP, shop, saved
// progress, and a long simulated play session without JavaScript errors.
//
// Run:  npm run build && npm run test:e2e
// Needs the `playwright` package and a Chromium build (CI installs both).

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '..', 'dist');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json',
};

// ── tiny static server for dist/ ─────────────────────────────────────────────
function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ── mini test harness ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    results.push(`  ✗ ${name}\n      ${err.message}`);
  }
}

// Advance the game deterministically by calling update() directly, so tests
// don't depend on real time. Optional random steering simulates a player.
async function simulate(page, frames, { steer = false, autoRestart = false } = {}) {
  return page.evaluate(({ frames, steer, autoRestart }) => {
    const g = window.__marbleGame;
    const dt = 1 / 60;
    let deaths = 0;
    let maxDist = 0;
    for (let i = 0; i < frames; i++) {
      if (steer && i % 20 === 0) {
        const r = Math.random();
        g.input.left  = r < 0.33;
        g.input.right = r > 0.66;
      }
      g.update(dt);
      if (i % 4 === 0) g.render();
      if (g.state === 'running') maxDist = Math.max(maxDist, g.distance);
      if (g.state === 'dead') {
        deaths++;
        if (!autoRestart) break;
        g.restart();
      }
    }
    g.input.left = g.input.right = false;
    return { state: g.state, deaths, maxDist, distance: g.distance };
  }, { frames, steer, autoRestart });
}

async function newPage(browser, baseUrl, errors, storage) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true });
  if (storage) {
    await context.addInitScript((data) => {
      if (sessionStorage.getItem('__seeded')) return;
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      sessionStorage.setItem('__seeded', '1');
    }, storage);
  }
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  await page.goto(baseUrl);
  await page.waitForFunction(() => !!window.__marbleGame);
  return page;
}

// ── tests ────────────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ not found – run `npm run build` first.');
    process.exit(1);
  }

  const server  = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  console.log('\nMarble Rush – E2E tests\n');

  // 1. Menu → play → countdown → running
  await test('game loads into the menu without errors', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const state = await page.evaluate(() => window.__marbleGame.state);
    assert(state === 'menu', `expected state "menu", got "${state}"`);
    assert(await page.isVisible('#play-btn') || await page.isVisible('#overlay'), 'start overlay not visible');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('PLAY starts a run that moves the marble forward', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => window.__marbleGame._onMenuPlay());
    let state = await page.evaluate(() => window.__marbleGame.state);
    assert(state === 'countdown', `expected "countdown", got "${state}"`);
    await simulate(page, 60 * 4);                 // countdown is ~3 s
    state = await page.evaluate(() => window.__marbleGame.state);
    assert(state === 'running', `expected "running" after countdown, got "${state}"`);
    const r = await simulate(page, 60 * 3);
    assert(r.distance > 0, `marble did not move (distance ${r.distance})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // 2. Game over, best distance saved, restart works
  await test('game over saves best distance and restart begins a new run', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => window.__marbleGame.startRun());
    await simulate(page, 60 * 6);
    // Move the void onto the marble and advance one frame in the SAME evaluate
    // call – otherwise the real-time game loop can roll the marble out of reach
    // in between (timing-dependent flake on CI).
    const dist = await page.evaluate(() => {
      const g = window.__marbleGame;
      g.shieldTimer = 0;
      g.fog.y = g.marble.y + 1000;                // void well past the marble (a speed boost can move it > radius per frame)
      g.update(1 / 60);
      // Read the distance after the final frame: a bounce in that frame can
      // move the marble back a metre (used to make this test flaky)
      return g.distance;
    });
    const after = await page.evaluate(() => ({
      state: window.__marbleGame.state,
      best: localStorage.getItem('mrBestDist'),
      overlay: !document.getElementById('gameover-overlay').classList.contains('hidden'),
    }));
    assert(after.state === 'dead', `expected "dead", got "${after.state}"`);
    assert(after.overlay, 'game-over screen not shown');
    assert(parseInt(after.best, 10) >= dist && dist > 0, `best distance not saved (dist ${dist}, saved ${after.best})`);
    await page.evaluate(() => window.__marbleGame.restart());
    const state = await page.evaluate(() => window.__marbleGame.state);
    assert(state === 'countdown', `restart did not start a new run (state "${state}")`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('shield absorbs one hit from the void', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => window.__marbleGame.startRun());
    await simulate(page, 60 * 4);
    const s = await page.evaluate(() => {
      const g = window.__marbleGame;
      g.shieldTimer = 10;
      g.fog.y = g.marble.y + 1000;                // same frame + margin, see game-over test
      g.update(1 / 60);
      return { state: g.state, shield: g.shieldTimer };
    });
    assert(s.state === 'running', `shield did not save the marble (state "${s.state}")`);
    assert(s.shield <= 0, 'shield was not consumed');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // 3. Saved progress survives a restart of the app
  await test('settings and progress survive a reload', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors, {
      mrBestDist: '4321', mrVolume: '35', mrPvpWins: '7',
      mrAchievements: JSON.stringify(['pvp_first_race']),
    });
    await page.reload();
    await page.waitForFunction(() => !!window.__marbleGame);
    const g = await page.evaluate(() => {
      const g = window.__marbleGame;
      return { best: g.bestDistance, wins: g._pvpTotalWins, ach: [...g._achievements] };
    });
    assert(g.best === 4321, `best distance not restored (got ${g.best})`);
    assert(g.wins === 7, `PvP wins not restored (got ${g.wins})`);
    assert(g.ach.includes('pvp_first_race'), 'achievements not restored');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('difficulty presets set the void speed and the slider highlights the matching preset', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors, { mrVoidRate: '20' });
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      const sel = () => [...document.querySelectorAll('#menu-panel-endless .difficulty-selected')].map(b => b.id);
      const out = { oldLow: g._voidRateSetting };
      document.getElementById('endless-btn').click();
      for (const id of ['easy-btn', 'normal-btn', 'hard-btn', 'insane-btn']) {
        document.getElementById(id).click();
        out[id] = { rate: g._voidRateSetting, sel: sel() };
      }
      const slider = document.getElementById('void-rate-slider');
      slider.value = '135'; slider.dispatchEvent(new Event('input'));
      out.custom = { rate: g._voidRateSetting, sel: sel(), stored: localStorage.getItem('mrVoidRate') };
      return out;
    });
    assert(r.oldLow === 50, `old low save not raised to the new minimum (got ${r.oldLow})`);
    const want = { 'easy-btn': 75, 'normal-btn': 100, 'hard-btn': 150, 'insane-btn': 200 };
    for (const [id, rate] of Object.entries(want)) {
      assert(r[id].rate === rate, `${id}: void speed ${r[id].rate}, expected ${rate}`);
      assert(r[id].sel.length === 1 && r[id].sel[0] === id, `${id}: highlighted ${r[id].sel.join(',')}`);
    }
    assert(r.custom.rate === 135 && r.custom.sel.length === 0 && r.custom.stored === '135',
      `custom slider value not applied (${JSON.stringify(r.custom)})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('corrupted save data falls back to safe defaults', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors, {
      mrBestDist: '-50', mrVolume: 'abc', mrPvpWins: 'NaN', mrAchievements: '{not json',
      mrSteerSens: '9999', mrVoidRate: '0',
    });
    const g = await page.evaluate(() => {
      const g = window.__marbleGame;
      return { best: g.bestDistance, wins: g._pvpTotalWins, ach: g._achievements.size,
               steer: g._steerSensitivity, voidRate: g._voidRateSetting };
    });
    assert(g.best === 0, `bad best distance not reset (got ${g.best})`);
    assert(g.wins === 0, `bad PvP wins not reset (got ${g.wins})`);
    assert(g.ach === 0, 'bad achievements data not reset');
    assert(g.steer === 100 && g.voidRate === 100, `bad settings not reset (steer ${g.steer}, void ${g.voidRate})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // 4. Shop
  await test('shop: buying costs coins and is blocked without enough coins', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => window.__marbleGame.startRun());
    await simulate(page, 60 * 4);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      g.openShop();
      const opened = g.state === 'shop';
      g.coinsCollected = 3;
      g._buyShopItem('magnet');                   // costs 5 → must fail
      const blocked = g.coinsCollected === 3 && !(g.magnetTimer > 0);
      g.coinsCollected = 30;
      g._buyShopItem('magnet');
      const bought = g.coinsCollected === 25 && g.magnetTimer === 12;
      g.closeShop();
      return { opened, blocked, bought, state: g.state };
    });
    assert(r.opened, 'shop did not open while running');
    assert(r.blocked, 'purchase succeeded without enough coins');
    assert(r.bought, 'purchase with enough coins did not work');
    assert(r.state === 'running', `closing the shop did not resume the run (state "${r.state}")`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // 5. Android back button behaviour
  await test('back button closes the shop instead of quitting', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => window.__marbleGame.startRun());
    await simulate(page, 60 * 4);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      g.openShop();
      const consumed = g.handleBackButton();
      return { consumed, state: g.state };
    });
    assert(r.consumed === true, 'back button was not handled by the game');
    assert(r.state === 'running', `expected "running" after back, got "${r.state}"`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('pause menu: back pauses, nothing moves, resume counts down, menu returns to start', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      // Get through the 3-2-1 into a running game; the shield keeps the void
      // from ending the run on an unlucky level (it would make back go to the menu)
      g.startRun();
      for (let i = 0; i < 60 * 5 && !(g.state === 'running' && g.distance > 100); i++) {
        g.shieldTimer = 5; g.update(1 / 60);
      }
      const consumed = g.handleBackButton();
      const paused = g.state;
      const pauseShown = document.getElementById('pause-overlay').classList.contains('visible');
      const y = g.marble.y;
      for (let i = 0; i < 120; i++) g.update(1 / 60);
      const moved = g.marble.y !== y;
      g.handleBackButton();
      const resumed = g.state;
      g.pauseRun();
      document.getElementById('pause-menu-btn').click();
      const final = g.state;
      // In the menu: back leaves a sub-menu first, and only quits on the start screen
      document.getElementById('endless-btn').click();
      const subBack    = g.handleBackButton();
      const mainActive = document.getElementById('menu-panel-main').classList.contains('active');
      const quitOnMain = !g.handleBackButton();
      return {
        consumed, paused, pauseShown, moved, resumed, final, subBack, mainActive, quitOnMain,
        menuShown: document.getElementById('overlay').classList.contains('visible'),
        pauseHidden: document.getElementById('pause-overlay').classList.contains('hidden'),
      };
    });
    assert(r.subBack && r.mainActive, 'back in a sub-menu did not return to the start menu');
    assert(r.quitOnMain, 'back on the start menu should leave the app');
    assert(r.consumed === true, 'back button was not handled by the game');
    assert(r.paused === 'paused' && r.pauseShown, `expected pause menu, got state "${r.paused}"`);
    assert(!r.moved, 'marble moved while paused');
    assert(r.resumed === 'countdown', `expected "countdown" after resume, got "${r.resumed}"`);
    assert(r.final === 'menu' && r.menuShown && r.pauseHidden, `expected start menu, got "${r.final}"`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // 6. PvP
  await test('PvP race finishes and shows a result', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => {
      const g = window.__marbleGame;
      g._pvpEnemyCount = 3;
      g.startPvpRun();
    });
    await simulate(page, 60 * 4);
    const running = await page.evaluate(() => ({ state: window.__marbleGame.state, bots: window.__marbleGame.pvpBots.length }));
    assert(running.state === 'running', `PvP did not start (state "${running.state}")`);
    assert(running.bots === 3, `expected 3 bots, got ${running.bots}`);
    await page.evaluate(() => {
      const g = window.__marbleGame;
      g.marble.y = g.track.startY + g._pvpGoalDistance + 10;   // jump to the finish
    });
    await simulate(page, 5);
    const end = await page.evaluate(() => ({ state: window.__marbleGame.state, wins: localStorage.getItem('mrPvpWins') }));
    assert(end.state === 'pvp_over', `race did not end (state "${end.state}")`);
    assert(end.wins === '1', `PvP win not saved (got ${end.wins})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // 7. Long session stress test
  await test('15 minutes of simulated play with random steering run without errors', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => window.__marbleGame.startRun());
    const r = await simulate(page, 60 * 60 * 15, { steer: true, autoRestart: true });
    assert(r.maxDist > 500, `marble never got far (max ${r.maxDist} m)`);
    assert(errors.length === 0, errors.slice(0, 5).join('\n'));
    console.log(`      (runs: ${r.deaths + 1}, best distance in test: ${r.maxDist} m)`);
    await page.context().close();
  });

  await test('long PvP session with 10 bots runs without errors', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => { window.__marbleGame._pvpEnemyCount = 10; window.__marbleGame.startPvpRun(); });
    await simulate(page, 60 * 60 * 3, { steer: true });
    assert(errors.length === 0, errors.slice(0, 5).join('\n'));
    await page.context().close();
  });

  // 8. Sound & app lifecycle
  // Simulate the page going to the background the way the browser does it.
  const setHidden = (page, hidden) => page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

  await test('music pauses when the app goes to the background and resumes after', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => window.__marbleGame.startRun());
    await page.waitForFunction(() => !window.__marbleGame.sound._audio.paused, null, { timeout: 5000 });
    await setHidden(page, true);
    const bg = await page.evaluate(() => ({ paused: window.__marbleGame.sound._audio.paused, inBg: window.__marbleGame.sound.inBackground }));
    assert(bg.paused, 'music still playing in the background');
    assert(bg.inBg, 'sound manager not in background state');
    await setHidden(page, false);
    const fg = await page.evaluate(() => ({ paused: window.__marbleGame.sound._audio.paused, inBg: window.__marbleGame.sound.inBackground }));
    assert(!fg.paused, 'music did not resume when the app came back');
    assert(!fg.inBg, 'sound manager still in background state');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('muted music stays off after returning from the background', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => { const g = window.__marbleGame; g.startRun(); g.sound.setMuted(true); g.sound._audio.pause(); });
    await setHidden(page, true);
    await setHidden(page, false);
    const paused = await page.evaluate(() => window.__marbleGame.sound._audio.paused);
    assert(paused, 'music started although it was muted');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('no sound effects and no new music while in the background', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      g.startRun();
      g.onAppHidden();
      g.sound._audioCtx = null;
      g.sound.playZap(); g.sound.playBlitz(); g.sound.playPowerRushStart();
      const ctxCreated = !!g.sound._audioCtx;
      g.sound.setVolume(50);           // must not restart music in background
      g.startRun();                    // neither must a new run
      return { ctxCreated, paused: g.sound._audio.paused };
    });
    assert(!r.ctxCreated, 'a sound effect was played while in the background');
    assert(r.paused, 'music started while in the background');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('returning mid-run starts a 3-2-1 countdown instead of continuing instantly', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(() => window.__marbleGame.startRun());
    await simulate(page, 60 * 4);
    await setHidden(page, true);
    await setHidden(page, false);
    const r = await page.evaluate(() => ({ state: window.__marbleGame.state, n: window.__marbleGame.startCountdownValue }));
    assert(r.state === 'countdown' && r.n === 3, `expected countdown 3, got ${r.state} ${r.n}`);
    await simulate(page, 60 * 4);
    const after = await page.evaluate(() => window.__marbleGame.state);
    assert(after === 'running', `run did not continue after the countdown (state "${after}")`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('going to the background in the menu does not start a run', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await setHidden(page, true);
    await setHidden(page, false);
    const state = await page.evaluate(() => window.__marbleGame.state);
    assert(state === 'menu', `state changed to "${state}"`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await browser.close();
  server.close();

  console.log(results.join('\n'));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
