// verify-capture — gameplay screenshot run for visual verification.
//
// Drives the full run with the path-following bot (same controller as
// tests/e2e/driveBot.ts) and screenshots the key moments by position:
// title, intro, spawn, the checkpoint, mid-route, the Hilux stretch, ending.
// Saves to scripts/.verify-shots/ (git-ignored). Not a test — a viewing aid.
//
// Usage: PW_BROWSER_CHANNEL=msedge node scripts/verify-capture.mjs
// (dev server must be running)

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '.verify-shots');
mkdirSync(OUT, { recursive: true });

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
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

// 1 — title
await page.waitForSelector('button.title-incident--open', { timeout: 20000 });
await page.waitForTimeout(1500);
await shot('1-title');

// 2 — intro
await page.click('button.title-incident--open');
await page.waitForSelector('button.story-card-action', { timeout: 20000 });
await page.waitForTimeout(800);
await shot('2-intro');

// 3 — spawn (camera settled)
await page.click('button.story-card-action');
await page.waitForTimeout(3000);
await shot('3-spawn');

// Drive with the path-follower; shoot at position milestones.
const milestones = [
  { z: -6,  name: '4-checkpoint' },
  { z: 360, name: '5-midroute' },
  { z: 575, name: '6-hilux-stretch' },
];
let prev = null;
let heading = 0;
const start = Date.now();

while (Date.now() - start < 170_000) {
  const { pos: p, phase } = await page.evaluate(() => ({
    pos: window.__fixerTruckPos ?? null,
    phase: window.__fixer_store?.useGame?.getState()?.phase ?? 'unknown',
  }));

  if (phase === 'ended') break;

  if (p && phase === 'running') {
    if (prev) {
      const dx = p.x - prev.x, dz = p.z - prev.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 25) heading = 0;
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

    // Milestone screenshots — pause the truck briefly for a stable frame.
    const m = milestones[0];
    if (m && p.z >= m.z) {
      milestones.shift();
      await page.evaluate(() => {
        const keys = window.__fixerKeys;
        if (keys) { keys.fwd = false; keys.left = false; keys.right = false; keys.brake = true; }
      });
      await page.waitForTimeout(900);
      await shot(m.name);
      await page.evaluate(() => {
        const keys = window.__fixerKeys;
        if (keys) keys.brake = false;
      });
    }
  }
  await page.waitForTimeout(140);
}

// 7 — ending card
await page.evaluate(() => {
  const keys = window.__fixerKeys;
  if (keys) { keys.fwd = false; keys.left = false; keys.right = false; }
});
await page.waitForSelector('.story-card', { state: 'visible', timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(1200);
await shot('7-ending');

await browser.close();
console.log('[verify-capture] done →', OUT);
