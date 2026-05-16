// Visual baseline capture — The Fixer
//
// Takes reference screenshots at 3 key game moments:
//   1. intro   — story card fully rendered before DRIVE
//   2. driving — truck on terrain, camera settled (3s after DRIVE)
//   3. beat    — beat flash text visible (first beat at Z=-75)
//
// Screenshots are saved to tests/visual/baselines/ and committed to git.
// The compare.mjs script diffs new screenshots against these baselines.
//
// Usage:
//   node tests/visual/baseline.mjs           -- capture new baselines
//   node tests/visual/baseline.mjs --force   -- overwrite existing baselines
//
// Requires:
//   - Dev server running on localhost:5173
//   - playwright installed in the project
//
// GPU rendering note: uses --use-gl=angle to force ANGLE software rasterizer.
// This gives more consistent output than default headless WebGL, which
// varies by OS and GPU driver. The tradeoff is slightly different colours
// than a real GPU — but it's CONSISTENT, which is what baseline diffing needs.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, 'baselines');
const FORCE = process.argv.includes('--force');

mkdirSync(BASELINE_DIR, { recursive: true });

const BROWSER_ARGS = [
  '--use-gl=angle',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-size=1280,800',
];

async function capture() {
  const browser = await chromium.launch({
    headless: false,
    args: BROWSER_ARGS,
  });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Suppress console noise from the game
  page.on('console', () => {});

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

  // Wait for React + physics to fully mount
  await page.waitForFunction(() => typeof window.__fixerRecord === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(2000);

  // ── 1. INTRO baseline ─────────────────────────────────────────────────────
  const introPath = join(BASELINE_DIR, 'intro.png');
  if (!existsSync(introPath) || FORCE) {
    await page.screenshot({ path: introPath, fullPage: false });
    console.log('[baseline] Captured: intro.png');
  } else {
    console.log('[baseline] Skipped (exists): intro.png — use --force to overwrite');
  }

  // ── 2. DRIVING baseline ───────────────────────────────────────────────────
  await page.evaluate(() => document.querySelector('button.story-card-action')?.click());
  await page.waitForTimeout(4000); // camera lerp + physics settle

  const drivingPath = join(BASELINE_DIR, 'driving.png');
  if (!existsSync(drivingPath) || FORCE) {
    await page.screenshot({ path: drivingPath, fullPage: false });
    console.log('[baseline] Captured: driving.png');
  } else {
    console.log('[baseline] Skipped (exists): driving.png');
  }

  // ── 3. BEAT baseline — hold W until first beat fires ─────────────────────
  await page.keyboard.down('w');

  // Wait for the beat flash to appear (first beat at Z≈-75)
  try {
    await page.waitForSelector('.beat-flash.show', { timeout: 30000 });
    await page.waitForTimeout(200); // let beat fully render

    const beatPath = join(BASELINE_DIR, 'beat-flash.png');
    if (!existsSync(beatPath) || FORCE) {
      await page.screenshot({ path: beatPath, fullPage: false });
      console.log('[baseline] Captured: beat-flash.png');
    } else {
      console.log('[baseline] Skipped (exists): beat-flash.png');
    }
  } catch {
    console.warn('[baseline] Beat flash did not appear within 30s — skipping beat baseline');
  }

  await page.keyboard.up('w');

  // Write a manifest with capture metadata
  const manifest = {
    capturedAt: new Date().toISOString(),
    gameUrl: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
    files: ['intro.png', 'driving.png', 'beat-flash.png'],
    note: 'Captured with --use-gl=angle (ANGLE software rasterizer). Colours may differ slightly from GPU-rendered output.'
  };
  writeFileSync(join(BASELINE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('[baseline] manifest.json written');

  await browser.close();
  console.log('[baseline] Done. Commit baselines/ to git to lock them in.');
}

capture().catch(e => {
  console.error('[baseline] Error:', e.message);
  process.exit(1);
});
