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

  await test('PvP bots: harder bots drive better, and none is faster than the player could be', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      const race = (diff, playerSpeedPickup) => {
        g._pvpDifficulty = diff; g._pvpEnemyCount = 10; g._pvpGoalDistance = 10000;
        g.startPvpRun(); g.state = 'running';
        let frames = 0, crashes = 0;
        for (; frames < 60 * 120 && g.state === 'running'; frames++) {
          // Park the player at the start so a bot always wins
          g.marble.y = g.track.startY; g.marble.vy = 0;
          if (playerSpeedPickup) g.speedBoostTimer = 10;
          const vy = g.pvpBots.map((b) => b.marble.vy);
          g.update(1 / 60);
          // A crash = losing > 100 of the downward speed in one frame from at most top speed
          g.pvpBots.forEach((b, i) => { if (vy[i] <= MAX_SPEED_Y + 5 && vy[i] - b.marble.vy > 100) crashes++; });
        }
        return { secs: frames / 60, crashesPerBotMin: crashes / 10 / (frames / 3600) };
      };
      const avg = (rs, k) => rs.reduce((s, x) => s + x[k], 0) / rs.length;
      const easy   = [race('easy'), race('easy'), race('easy')];
      const insane = [race('insane'), race('insane'), race('insane', true)];
      return {
        easySecs: avg(easy, 'secs'), insaneSecs: avg(insane, 'secs'),
        easyCrash: avg(easy, 'crashesPerBotMin'), insaneCrash: avg(insane, 'crashesPerBotMin'),
        fastest: Math.min(...insane.map((x) => x.secs)),
        playerBest: 10000 / MAX_SPEED_Y,   // flat out at top speed, no obstacles
      };
    });
    assert(r.insaneSecs < r.easySecs - 2,
      `insane bots (${r.insaneSecs.toFixed(1)} s) should win clearly faster than easy bots (${r.easySecs.toFixed(1)} s)`);
    assert(r.insaneCrash < r.easyCrash,
      `insane bots crash more than easy ones (${r.insaneCrash.toFixed(1)} vs ${r.easyCrash.toFixed(1)} per bot per min)`);
    assert(r.fastest > r.playerBest * 0.9,
      `a bot won in ${r.fastest.toFixed(1)} s – faster than the player could ever be (~${r.playerBest.toFixed(1)} s)`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('PvP bots do not get stuck on a red door when hazards wait behind the open one', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      g.startRun(); g.state = 'menu';                       // just for a fresh track
      const y = g.track.startY + 120;
      const { left, right } = g.track.getWallsAtY(y);
      const gate = new DoorGate(y, left, right); gate.correctDoor = 2;
      // Seen in a real run: a rotating bar and a flipper below the open door
      const obstacles = [gate,
        new RotatingBar(right - 45, y + 110, 40, 2.5),
        new Flipper(y + 230, 'right', g.track.getWallsAtY(y + 230).right, 70)];
      const d = gate.doors[1];
      const bot = new BotMarble(d.x + d.w / 2, y - 40, 0, g.track.startY, 'insane');
      for (let i = 0; i < 60 * 4; i++) {
        for (const o of obstacles) o.update(1 / 60);
        bot.update(1 / 60, g.track, 1, 1, obstacles);
        for (const o of obstacles) o.checkCollision(bot.marble);
      }
      return { passed: bot.marble.y > y + 20, y: Math.round(bot.marble.y - y) };
    });
    assert(r.passed, `bot is still above the door gate after 4 s (${r.y} px from it)`);
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

  // 9. Reproducible levels (seed) and the ghost of the best run
  const levelSnapshot = () => {
    const g = window.__marbleGame;
    const upTo = g.track.startY + 30000;
    return JSON.stringify({
      knots: g.track.knots.filter((k) => k[0] < upTo).map((k) => k.map((v) => Math.round(v * 100))),
      obstacles: g.obstacles.filter((o) => o.worldY < upTo).map((o) => [o.constructor.name, Math.round(o.worldY)]),
      coins: g.coins.filter((c) => c.worldY < upTo).map((c) => [Math.round(c.x), Math.round(c.worldY)]),
      pickups: g.pickups.filter((c) => c.worldY < upTo).map((c) => [c.type, Math.round(c.x), Math.round(c.worldY)]),
    });
  };

  await test('same seed builds the identical level, no matter how fast it is generated', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate((snapSrc) => {
      const snap = new Function(`return (${snapSrc})()`);
      const g = window.__marbleGame;
      g._init(4242); g._extendLevel(g.track.startY + 32000); const a = snap();
      // generate in small, uneven steps with other random calls in between
      g._init(4242);
      for (let y = g.track.startY; y < g.track.startY + 32000; y += 37) { g._extendLevel(y); Math.random(); Math.random(); }
      const b = snap();
      g._init(777); g._extendLevel(g.track.startY + 32000); const c = snap();
      return { same: a === b, differs: a !== c, size: JSON.parse(a).obstacles.length };
    }, levelSnapshot.toString());
    assert(r.size > 50, `too few obstacles generated (${r.size})`);
    assert(r.same, 'same seed produced a different level');
    assert(r.differs, 'different seeds produced the same level');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('ghost mode off: every run gets a new random track', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const seeds = await page.evaluate(() => {
      const g = window.__marbleGame; g.ghostMode = false; const out = [];
      for (let i = 0; i < 4; i++) { g.startRun(); out.push(g.levelSeed); }
      return out;
    });
    assert(new Set(seeds).size === seeds.length, `seeds repeated: ${seeds.join(', ')}`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // Drive a run with a fixed input pattern; returns marble positions over time
  const driveFixed = (frames) => {
    const g = window.__marbleGame;
    const out = [];
    for (let i = 0; i < frames; i++) {
      const ph = Math.floor(i / 40) % 4; g.input.left = ph === 1; g.input.right = ph === 3;
      g.shieldTimer = 2; g.update(1 / 60);
      if (g.state === 'shop') g.closeShop();
      if (g.state === 'running' && i % 30 === 0) {
        const pos = g._ghostReplay ? g._ghostReplay.positionAt(g.elapsed) : null;
        out.push(pos ? Math.hypot(pos.x - g.marble.x, pos.y - g.marble.y) : -1);
      }
    }
    g.input.left = g.input.right = false;
    return out;
  };
  const killRun = () => {
    const g = window.__marbleGame;
    g.shieldTimer = 0; g.fog.y = g.marble.y + 1000; g.update(1 / 60);
    return g.state;
  };

  await test('best run is saved as ghost; ghost mode replays it on the same track', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(({ driveSrc, killSrc }) => {
      const drive = new Function(`return (${driveSrc})`)();
      const kill = new Function(`return (${killSrc})`)();
      const g = window.__marbleGame;
      g.ghostMode = false;
      g.startRun(); const seed1 = g.levelSeed; drive(60 * 20); const state = kill();
      const ghost = g.bestGhost;
      g.ghostMode = true;
      g.startRun(); const seed2 = g.levelSeed; const gaps = drive(60 * 20);
      return { state, saved: !!ghost, ghostSeed: ghost && ghost.seed, seed1, seed2, samples: ghost && ghost.length,
               maxGap: Math.max(...gaps), replaying: !!g._ghostReplay, stored: !!localStorage.getItem('mrGhost') };
    }, { driveSrc: driveFixed.toString(), killSrc: killRun.toString() });
    assert(r.state === 'dead', `run did not end (${r.state})`);
    assert(r.saved && r.stored, 'ghost was not saved');
    assert(r.ghostSeed === r.seed1, 'ghost does not store the level seed');
    assert(r.seed2 === r.seed1, 'ghost mode did not reuse the ghost track');
    assert(r.samples > 200, `ghost too short (${r.samples} samples)`);
    assert(r.replaying, 'ghost is not being replayed');
    assert(r.maxGap < 2 * 12, `ghost drifted ${r.maxGap.toFixed(1)} px from an identical run`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('a worse run keeps the ghost, a better run replaces it', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(({ driveSrc, killSrc }) => {
      const drive = new Function(`return (${driveSrc})`)();
      const kill = new Function(`return (${killSrc})`)();
      const g = window.__marbleGame; g.ghostMode = true;
      g.startRun(); drive(60 * 12); kill(); const first = g.bestGhost.result;
      g.startRun(); drive(60 * 5); kill(); const afterWorse = g.bestGhost.result;
      g.startRun(); drive(60 * 25); kill(); const afterBetter = g.bestGhost.result;
      return { first, afterWorse, afterBetter };
    }, { driveSrc: driveFixed.toString(), killSrc: killRun.toString() });
    assert(r.afterWorse === r.first, `worse run replaced the ghost (${r.first} -> ${r.afterWorse})`);
    assert(r.afterBetter > r.first, `better run did not replace the ghost (${r.first} -> ${r.afterBetter})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('Ghost Mode checkbox is in the endless menu and remembered after a restart', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    assert(await page.$('#ghost-mode-toggle'), 'Ghost Mode checkbox missing');
    const before = await page.evaluate(() => ({ checked: document.getElementById('ghost-mode-toggle').checked, mode: window.__marbleGame.ghostMode }));
    assert(!before.checked && !before.mode, 'Ghost Mode should be off by default');
    await page.evaluate(() => { const t = document.getElementById('ghost-mode-toggle'); t.checked = true; t.dispatchEvent(new Event('change')); });
    await page.reload();
    await page.waitForFunction(() => !!window.__marbleGame);
    const after = await page.evaluate(() => ({ checked: document.getElementById('ghost-mode-toggle').checked, mode: window.__marbleGame.ghostMode, info: document.getElementById('ghost-mode-info').textContent }));
    assert(after.checked && after.mode, 'Ghost Mode was not remembered');
    assert(/ghost/i.test(after.info), `no ghost info text (${after.info})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('corrupted ghost data is ignored (random track, no crash)', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors, { mrGhost: '{"v":1,"seed":5,"xs":[1,2],"dy":[1]}', mrGhostMode: '1' });
    const r = await page.evaluate(() => { const g = window.__marbleGame; g.startRun(); return { ghost: !!g.bestGhost, replay: !!g._ghostReplay }; });
    assert(!r.ghost && !r.replay, 'invalid ghost data was used');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // 10. Ghost slots: best run + 5 saved ghosts
  await test('game over: "Save as ghost" stores the run in a free slot and can race it', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(({ driveSrc, killSrc }) => {
      const drive = new Function(`return (${driveSrc})`)();
      const kill = new Function(`return (${killSrc})`)();
      const g = window.__marbleGame; g.ghostMode = false;
      g.startRun(); drive(60 * 10); kill();
    }, { driveSrc: driveFixed.toString(), killSrc: killRun.toString() });
    assert(await page.isVisible('#go-ghost'), 'ghost box not shown on the game-over screen');
    const seed = await page.evaluate(() => window.__marbleGame.levelSeed);
    await page.click('#go-ghost-actions .btn-ghost');                       // SAVE AS GHOST
    const saved = await page.evaluate(() => {
      const g = window.__marbleGame;
      return { slot1: g.ghosts.slots[0] && g.ghosts.slots[0].seed, stored: !!localStorage.getItem('mrGhostSlot1'),
               msg: document.getElementById('go-ghost-msg').textContent,
               btn: document.querySelector('#go-ghost-actions .btn-ghost').textContent };
    });
    assert(saved.slot1 === seed && saved.stored, 'run was not saved into slot 1');
    assert(/Ghost #1/.test(saved.msg), `unexpected message "${saved.msg}"`);
    assert(/RACE GHOST #1/.test(saved.btn), `no race button (${saved.btn})`);
    await page.click('#go-ghost-actions .btn-ghost');                       // RACE GHOST #1
    const race = await page.evaluate(() => {
      const g = window.__marbleGame;
      return { seed: g.levelSeed, source: g._ghostSource, mode: g.ghostMode, sel: localStorage.getItem('mrGhostSel'), state: g.state };
    });
    assert(race.seed === seed, 'race did not use the saved track');
    assert(race.source === 1 && race.mode && race.sel === '1', `wrong ghost selected (${JSON.stringify(race)})`);
    assert(race.state === 'countdown', `run did not start (${race.state})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('six ghosts: best run + 5 slots; when full you pick one to replace', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(({ driveSrc, killSrc }) => {
      const drive = new Function(`return (${driveSrc})`)();
      const kill = new Function(`return (${killSrc})`)();
      const g = window.__marbleGame; g.ghostMode = false;
      const seeds = [];
      for (let i = 0; i < 6; i++) { g.startRun(); drive(60 * (4 + i)); kill(); seeds.push(g.levelSeed); if (i < 5) g.saveLastRunAsGhost(); }
      const filled = g.ghosts.slots.map((x) => x && x.seed);
      // 6th run: all slots used → the game-over button offers a replace grid
      document.querySelector('#go-ghost-actions .btn-ghost').click();
      const choices = document.querySelectorAll('.go-ghost-replace button').length;
      document.querySelectorAll('.go-ghost-replace button')[2].click();     // replace #3
      return { seeds, filled, choices, slot3: g.ghosts.slots[2].seed, best: !!g.ghosts.best,
               rows: (() => { g.setGhostMode(true); return document.querySelectorAll('#ghost-list .ghost-row').length; })() };
    }, { driveSrc: driveFixed.toString(), killSrc: killRun.toString() });
    assert(JSON.stringify(r.filled) === JSON.stringify(r.seeds.slice(0, 5)), 'slots not filled in order');
    assert(r.choices === 5, `expected 5 replace choices, got ${r.choices}`);
    assert(r.slot3 === r.seeds[5], 'slot 3 was not replaced');
    assert(r.best, 'best-run ghost missing');
    assert(r.rows === 6, `menu list should show 6 ghosts, shows ${r.rows}`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('beating a saved ghost on its track updates that slot (best run untouched if lower)', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(({ driveSrc, killSrc }) => {
      const drive = new Function(`return (${driveSrc})`)();
      const kill = new Function(`return (${killSrc})`)();
      const g = window.__marbleGame; g.ghostMode = false;
      g.startRun(); drive(60 * 30); kill(); const bestResult = g.ghosts.best.result;   // long run → best
      g.startRun(); drive(60 * 6); kill(); g.saveLastRunAsGhost(1); const slotBefore = g.ghosts.slots[0].result; const seed = g.ghosts.slots[0].seed;
      g.raceGhost(1); drive(60 * 12); kill();
      return { bestResult, bestAfter: g.ghosts.best.result, slotBefore, slotAfter: g.ghosts.slots[0].result, sameTrack: g.ghosts.slots[0].seed === seed,
               msg: document.getElementById('go-ghost-msg').textContent };
    }, { driveSrc: driveFixed.toString(), killSrc: killRun.toString() });
    assert(r.slotAfter > r.slotBefore, `slot not updated (${r.slotBefore} -> ${r.slotAfter})`);
    assert(r.sameTrack, 'slot changed its track');
    assert(r.bestAfter === r.bestResult, 'best-run ghost changed although the run was not a new best');
    assert(/Ghost #1 beaten/.test(r.msg), `no "beaten" message (${r.msg})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('ghost list: select a ghost, delete with confirm; empty slot falls back to best', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    await page.evaluate(({ driveSrc, killSrc }) => {
      const drive = new Function(`return (${driveSrc})`)();
      const kill = new Function(`return (${killSrc})`)();
      const g = window.__marbleGame; g.ghostMode = false;
      g.startRun(); drive(60 * 8); kill(); g.saveLastRunAsGhost(2);
      g.ui.hideGameOver(); g.setGhostMode(true);
      g.ui.showStart(g._onMenuDifficulty, g._onMenuPlay, g._onPvpDifficulty);
    }, { driveSrc: driveFixed.toString(), killSrc: killRun.toString() });
    await page.click('#endless-btn');
    await page.click('#ghost-list [data-sel="2"]');
    let st = await page.evaluate(() => ({ sel: window.__marbleGame.ghostSel, stored: localStorage.getItem('mrGhostSel') }));
    assert(st.sel === 2 && st.stored === '2', `selection not saved (${JSON.stringify(st)})`);
    await page.click('#ghost-list [data-del="2"]');                  // first tap: confirm
    let still = await page.evaluate(() => !!window.__marbleGame.ghosts.slots[1]);
    assert(still, 'deleted without confirmation');
    await page.click('#ghost-list [data-del="2"]');                  // second tap: delete
    st = await page.evaluate(() => { const g = window.__marbleGame; g.startRun(); return { slot: !!g.ghosts.slots[1], stored: !!localStorage.getItem('mrGhostSlot2'), sel: g.ghostSel, source: g._ghostSource }; });
    assert(!st.slot && !st.stored, 'slot not deleted');
    assert(st.sel === 'best' && st.source === 'best', `did not fall back to best (${JSON.stringify(st)})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('ghost from 1.2.0 (single best ghost) is still there after the update', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const data = await page.evaluate(({ driveSrc, killSrc }) => {
      const drive = new Function(`return (${driveSrc})`)();
      const kill = new Function(`return (${killSrc})`)();
      const g = window.__marbleGame; g.startRun(); drive(60 * 6); kill();
      return localStorage.getItem('mrGhost');
    }, { driveSrc: driveFixed.toString(), killSrc: killRun.toString() });
    await page.context().close();
    const page2 = await newPage(browser, baseUrl, errors, { mrGhost: data, mrGhostMode: '1' });
    const r = await page2.evaluate(() => { const g = window.__marbleGame; g.startRun(); return { best: !!g.ghosts.best, source: g._ghostSource }; });
    assert(r.best && r.source === 'best', 'old ghost not picked up');
    assert(errors.length === 0, errors.join('\n'));
    await page2.context().close();
  });

  await test('game over without coins does not show the previous run\'s coin total', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      g.startRun(); for (let i = 0; i < 300; i++) g.update(1 / 60);
      g.coinsCollected = 7; g.shieldTimer = 0; g.fog.y = g.marble.y + 1000; g.update(1 / 60);
      g.ui.hideGameOver();
      g.startRun(); for (let i = 0; i < 300; i++) g.update(1 / 60);
      g.coinsCollected = 0; g.shieldTimer = 0; g.fog.y = g.marble.y + 1000; g.update(1 / 60);
      const el = document.getElementById('go-coin-breakdown');
      return { display: getComputedStyle(el).display };
    });
    assert(r.display === 'none', `coin breakdown still visible (display: ${r.display})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('game over without coins does not show the previous run\'s coin total', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      g.startRun(); for (let i = 0; i < 300; i++) g.update(1 / 60);
      g.coinsCollected = 7; g.shieldTimer = 0; g.fog.y = g.marble.y + 1000; g.update(1 / 60);
      g.ui.hideGameOver();
      g.startRun(); for (let i = 0; i < 300; i++) g.update(1 / 60);
      g.coinsCollected = 0; g.shieldTimer = 0; g.fog.y = g.marble.y + 1000; g.update(1 / 60);
      const el = document.getElementById('go-coin-breakdown');
      return { display: getComputedStyle(el).display };
    });
    assert(r.display === 'none', `coin breakdown still visible (display: ${r.display})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  // 11. Control style: buttons / finger (drag joystick) / both
  const startRunUi = async (page) => {
    await page.evaluate(() => {
      const g = window.__marbleGame;
      document.querySelectorAll('.overlay').forEach((o) => { o.classList.remove('visible'); o.classList.add('hidden'); });
      const c = document.getElementById('game-container'); if (c) c.classList.remove('in-menu');
      g.startRun(); for (let i = 0; i < 60 * 4; i++) g.update(1 / 60);
    });
  };
  const canvasPoint = (page, fx, fy) => page.evaluate(({ fx, fy }) => {
    const r = document.getElementById('gameCanvas').getBoundingClientRect();
    return { x: r.left + r.width * fx, y: r.top + r.height * fy };
  }, { fx, fy });

  await test('controls setting: Buttons by default, Finger hides the buttons, choice is remembered', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    let st = await page.evaluate(() => ({ mode: window.__marbleGame.controlMode, active: document.querySelector('.control-mode-btn.active').dataset.mode }));
    assert(st.mode === 'buttons' && st.active === 'buttons', `default is not Buttons (${JSON.stringify(st)})`);
    await page.click('.control-mode-btn[data-mode="touch"]');
    await startRunUi(page);
    const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('mobile-controls')).display === 'none');
    assert(hidden, 'buttons still shown in Finger mode');
    await page.reload(); await page.waitForFunction(() => !!window.__marbleGame);
    st = await page.evaluate(() => ({ mode: window.__marbleGame.controlMode, stored: localStorage.getItem('mrControls') }));
    assert(st.mode === 'touch' && st.stored === 'touch', 'Finger mode not remembered');
    await page.click('.control-mode-btn[data-mode="both"]');
    await startRunUi(page);
    const shown = await page.evaluate(() => getComputedStyle(document.getElementById('mobile-controls')).display !== 'none');
    assert(shown, 'buttons hidden in Both mode');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('finger mode: dragging on the playfield steers, brakes and boosts; release stops', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors, { mrControls: 'touch' });
    await startRunUi(page);
    const p0 = await canvasPoint(page, 0.5, 0.55);
    const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).id, p0);
    assert(top === 'gameCanvas', `touches on the playfield land on "${top}", not the canvas`);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down();
    await page.mouse.move(p0.x + 70, p0.y, { steps: 4 });
    const right = await page.evaluate(() => ({ s: window.__marbleGame.input.steerX, j: !!window.__marbleGame.input.joystick }));
    await page.mouse.move(p0.x, p0.y - 70, { steps: 4 });
    const up = await page.evaluate(() => window.__marbleGame.input.throttleY);
    await page.mouse.move(p0.x, p0.y + 70, { steps: 4 });
    const down = await page.evaluate(() => window.__marbleGame.input.throttleY);
    await page.mouse.move(p0.x + 3, p0.y + 2, { steps: 2 });
    const centre = await page.evaluate(() => ({ s: window.__marbleGame.input.steerX, t: window.__marbleGame.input.throttleY }));
    await page.mouse.up();
    const after = await page.evaluate(() => ({ s: window.__marbleGame.input.steerX, t: window.__marbleGame.input.throttleY, j: window.__marbleGame.input.joystick }));
    assert(right.j && right.s > 0.9, `drag right did not steer right (${right.s})`);
    assert(up < -0.9, `drag up did not brake (${up})`);
    assert(down > 0.9, `drag down did not boost (${down})`);
    assert(centre.s === 0 && centre.t === 0, `dead zone not neutral (${JSON.stringify(centre)})`);
    assert(after.s === 0 && after.t === 0 && after.j === null, 'release did not reset the joystick');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('finger held down for 4 s keeps steering, even when Android cancels the pointer (long-press)', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors, { mrControls: 'touch' });
    await startRunUi(page);
    const cdp = await page.context().newCDPSession(page);
    const p0 = await canvasPoint(page, 0.5, 0.6);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
    // record whether our handler blocked the browser's default touch actions
    await page.evaluate(() => {
      window.__prevented = [];
      window.addEventListener('touchstart', (e) => window.__prevented.push(e.defaultPrevented), { passive: true });
    });
    await touch('touchStart', p0.x, p0.y);
    await touch('touchMove', p0.x + 70, p0.y);
    const samples = [];
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(500);
      if (i === 2) {
        // what Android Chrome does on a long press: cancel the pointer stream
        await page.evaluate(() => document.getElementById('gameCanvas').dispatchEvent(
          new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'touch', bubbles: true })));
      }
      samples.push(await page.evaluate(() => window.__marbleGame.input.steerX));
    }
    const ctx = await page.evaluate(() => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.getElementById('gameCanvas').dispatchEvent(ev);
      return { contextBlocked: ev.defaultPrevented, prevented: window.__prevented };
    });
    await touch('touchEnd');
    const after = await page.evaluate(() => window.__marbleGame.input.steerX);
    assert(samples.every((v) => v > 0.9), `steering dropped while the finger was held: ${samples.map((v) => v.toFixed(2)).join(', ')}`);
    assert(after === 0, 'lifting the finger did not stop steering');
    assert(ctx.prevented.length > 0 && ctx.prevented.every(Boolean), 'touchstart not cancelled – browser long-press can still kick in');
    assert(ctx.contextBlocked, 'long-press context menu not blocked');
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('buttons mode: dragging on the playfield does nothing', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors, { mrControls: 'buttons' });
    await startRunUi(page);
    const p0 = await canvasPoint(page, 0.5, 0.55);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down();
    await page.mouse.move(p0.x + 70, p0.y, { steps: 4 });
    const s = await page.evaluate(() => window.__marbleGame.input.steerX);
    await page.mouse.up();
    assert(s === 0, `joystick active in Buttons mode (${s})`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('full joystick deflection is exactly as strong as a button (fair)', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const r = await page.evaluate(() => {
      const g = window.__marbleGame;
      const run = (input) => {
        const m = new Marble(240, 0); m.vy = 200;
        const flat = { resolveCollision() {} };
        for (let i = 0; i < 30; i++) m.update(1 / 60, input, flat, 1, 1);
        return [Math.round(m.vx * 1000), Math.round(m.vy * 1000)];
      };
      return {
        steer: [run({ right: true }), run({ steerX: 1 }), run({ steerX: 0.5 })],
        boost: [run({ down: true }), run({ throttleY: 1 })],
        brake: [run({ up: true }), run({ throttleY: -1 })],
      };
    });
    const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
    assert(eq(r.steer[0], r.steer[1]), `steer differs: button ${r.steer[0]} vs joystick ${r.steer[1]}`);
    assert(Math.abs(r.steer[2][0]) < Math.abs(r.steer[1][0]), 'half deflection is not weaker');
    assert(eq(r.boost[0], r.boost[1]), `boost differs: ${r.boost[0]} vs ${r.boost[1]}`);
    assert(eq(r.brake[0], r.brake[1]), `brake differs: ${r.brake[0]} vs ${r.brake[1]}`);
    assert(errors.length === 0, errors.join('\n'));
    await page.context().close();
  });

  await test('menu says "Versus" instead of PvP', async () => {
    const errors = [];
    const page = await newPage(browser, baseUrl, errors);
    const text = await page.evaluate(() => document.body.innerText);
    assert(/versus/i.test(text), '"Versus" not found in the menu');
    assert(!/\bPvP\b|\bPVP\b/.test(text), 'visible text still says PvP');
    const ach = await page.evaluate(() => ACHIEVEMENT_DEFS.filter((a) => /PvP/.test(a.desc)).length);
    assert(ach === 0, `${ach} achievement descriptions still say PvP`);
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
