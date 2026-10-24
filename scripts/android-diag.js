#!/usr/bin/env node
// Drives the running app inside the Android emulator through Playwright's
// Android/WebView support and records layout metrics + screenshots for:
// menu, running endless game, double-tap on a control button, the HUD
// fullscreen button, and PvP. Used by scripts/android-smoke.sh.
'use strict';
const fs = require('fs');
const path = require('path');
const { _android } = require('playwright');

const OUT = process.argv[2] || 'smoke-out';
const TAG = process.argv[3] || 'normal';
const PKG = 'com.nexiuska.marblerush';
const log = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const [device] = await _android.devices();
  if (!device) throw new Error('no android device');
  const webview = await device.webView({ pkg: PKG }, { timeout: 30000 });
  const page = await webview.page();

  const metrics = (label) => page.evaluate((label) => {
    const vv = window.visualViewport;
    const c = document.getElementById('game-container');
    const r = c ? c.getBoundingClientRect() : null;
    const g = window.__marbleGame;
    return {
      label,
      state: g ? g.state : null,
      inner: [window.innerWidth, window.innerHeight],
      client: [document.documentElement.clientWidth, document.documentElement.clientHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight, Math.round(window.scrollX), Math.round(window.scrollY)],
      visualViewport: vv ? [Math.round(vv.width), Math.round(vv.height), +vv.scale.toFixed(3), Math.round(vv.offsetLeft), Math.round(vv.offsetTop)] : null,
      fullscreen: !!(document.fullscreenElement || document.webkitFullscreenElement),
      containerTransform: c ? c.style.transform : null,
      containerRect: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null,
      canvas: g ? [g.canvas.width, g.canvas.height] : null,
      dpr: window.devicePixelRatio,
    };
  }, label);
  const step = async (label, shot) => {
    const m = await metrics(label);
    log.push(m);
    if (shot) await device.screenshot({ path: path.join(OUT, `diag-${TAG}-${shot}.png`) });
  };

  // Start from a fresh page load (the smoke test before this left a run going)
  await page.reload().catch(() => {});
  await page.waitForFunction(() => !!window.__marbleGame || !document.getElementById('game-container'), null, { timeout: 30000 }).catch(() => {});
  await sleep(2000);

  if (!(await page.evaluate(() => !!window.__marbleGame))) {
    log.push({ label: 'no game on page (update page shown?)', url: page.url() });
    fs.writeFileSync(path.join(OUT, `diag-${TAG}.json`), JSON.stringify(log, null, 2));
    return;
  }

  await step('menu', '1-menu');
  await page.click('#endless-btn'); await sleep(800);
  await page.click('#play-btn'); await sleep(6000);
  await step('endless running', '2-endless');

  // Rapid double taps on a control button (players hammer these)
  for (let i = 0; i < 3; i++) { await page.click('#btn-left'); await sleep(120); await page.click('#btn-left'); await sleep(400); }
  await sleep(1500);
  await step('after double taps on control', '3-doubletap');

  // HUD fullscreen button (only visible in endless HUD)
  const fsVisible = await page.isVisible('#fullscreen-btn');
  log.push({ label: 'fullscreen button visible', fsVisible });
  if (fsVisible) {
    await page.click('#fullscreen-btn'); await sleep(2500);
    await step('after fullscreen button', '4-fullscreen');
    await page.click('#fullscreen-btn').catch(() => {}); await sleep(2500);
    await step('after fullscreen button again', '5-fullscreen-off');
  }

  // PvP for comparison
  await page.evaluate(() => {
    const g = window.__marbleGame;
    g.state = 'menu'; g.ui.showStart(g._onMenuDifficulty, g._onMenuPlay, g._onPvpDifficulty);
  });
  await sleep(800);
  await page.evaluate(() => { const b = document.getElementById('pvp-btn'); if (b) b.click(); });
  await sleep(600);
  if (await page.isVisible('#pvp-play-btn')) { await page.click('#pvp-play-btn'); await sleep(6000); }
  await step('pvp running', '6-pvp');
  log.push({ label: 'fullscreen button visible in pvp', fsVisible: await page.isVisible('#fullscreen-btn') });

  fs.writeFileSync(path.join(OUT, `diag-${TAG}.json`), JSON.stringify(log, null, 2));
})().catch((e) => {
  log.push({ error: String(e && e.stack || e) });
  fs.writeFileSync(path.join(OUT, `diag-${TAG}.json`), JSON.stringify(log, null, 2));
}).finally(() => process.exit(0));
