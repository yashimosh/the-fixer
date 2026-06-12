// diag-fall — drive the full run with the path-following bot, logging
// position/speed. Mirrors tests/e2e/driveBot.ts (which is TS and can't be
// imported from an .mjs script).
// Usage: PW_BROWSER_CHANNEL=msedge node scripts/diag-fall.mjs

import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  channel: process.env.PW_BROWSER_CHANNEL || undefined,
  args: [
    '--use-gl=angle',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--window-size=1280,800',
  ],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('console', () => {});
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

await page.waitForSelector('button.title-incident--open', { timeout: 20000 });
await page.click('button.title-incident--open');
await page.waitForSelector('button.story-card-action', { timeout: 20000 });
await page.click('button.story-card-action');
await page.waitForTimeout(2500); // settle

const start = Date.now();
let prev = null;
let heading = 0;
let jamCount = 0;
let n = 0;

for (;;) {
  const { pos: p, phase } = await page.evaluate(() => ({
    pos: window.__fixerTruckPos ?? null,
    phase: window.__fixer_store?.useGame?.getState()?.phase ?? 'unknown',
  }));

  const t = ((Date.now() - start) / 1000).toFixed(1);

  if (p && phase === 'running') {
    if (prev) {
      const dx = p.x - prev.x, dz = p.z - prev.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 25) heading = 0;           // recovery teleport → faces +Z
      else if (d2 > 0.09) heading = Math.atan2(dx, dz);
    }
    prev = { x: p.x, z: p.z };

    const centering = Math.max(-0.5, Math.min(0.5, (p.trackX - p.x) * 0.06));
    const desired = Math.atan2((p.trackTanX ?? 0) + centering, 1);
    let err = desired - heading;
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    const steer = err > 0.10 ? 1 : err < -0.10 ? -1 : 0;
    const lift = Math.abs(err) > 0.5 && p.kmh > 22;

    await page.evaluate(({ steer, lift }) => {
      const keys = window.__fixerKeys;
      if (!keys) return;
      keys.fwd = !lift;
      keys.left = steer > 0;
      keys.right = steer < 0;
    }, { steer, lift });

    if (n % 7 === 0) {
      console.log(`t=${t}s  x=${p.x}  y=${p.y}  z=${p.z}  track=${p.trackX}  gnd=${p.groundY}  v=${p.kmh}km/h  err=${err.toFixed(2)}`);
    }

    if (p.kmh === 0 && Number(t) > 4) {
      jamCount++;
      if (jamCount === 14) {
        console.log('>>> JAMMED 2s — screenshotting');
        await page.screenshot({ path: 'scripts/.verify-shots/diag-jam.png' });
      }
    } else jamCount = 0;

    if (p.y < -50) { console.log('>>> FELL THROUGH'); break; }
    if (p.z > 705) { console.log(`>>> REACHED END at t=${t}s`); break; }
  } else if (phase === 'ended') {
    console.log(`>>> ENDED (story card) at t=${t}s`);
    break;
  }

  if (Date.now() - start > 150_000) { console.log('>>> 150s timeout'); break; }
  await page.waitForTimeout(140);
  n++;
}

await page.evaluate(() => {
  const keys = window.__fixerKeys;
  if (keys) { keys.fwd = false; keys.left = false; keys.right = false; }
});
await page.screenshot({ path: 'scripts/.verify-shots/diag-final.png' });
await browser.close();
