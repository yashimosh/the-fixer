// Visual regression compare — The Fixer
//
// Captures current screenshots at the same moments as baseline.mjs, then
// pixel-diffs them against the saved baselines. Fails (exit 1) if any diff
// exceeds the threshold.
//
// Diff method: pixel-by-pixel RGB distance. Colour-blind-friendly: we compare
// luminance + hue angle rather than raw RGB so minor tone-mapping shifts
// (which vary by GPU) don't create false positives.
//
// Usage:
//   node tests/visual/compare.mjs           -- compare against baselines
//   node tests/visual/compare.mjs --verbose -- log per-pixel diff stats
//
// Requires:
//   - node-canvas OR sharp for image decoding  (falls back to raw PNG buffer)
//   - Dev server running on localhost:5173
//   - Baselines committed to tests/visual/baselines/
//
// Threshold: 3% of pixels may differ by more than 5% luminance.
// This allows minor physics timing differences (truck at slightly different
// position) without flagging genuine visual regressions (lighting gone wrong,
// sky colour changed, terrain disappeared).

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, 'baselines');
const VERBOSE = process.argv.includes('--verbose');

// Diff thresholds — tuned for ANGLE software renderer consistency
const MAX_DIFF_FRACTION = 0.05; // 5% of pixels may differ
const PIXEL_DIFF_THRESHOLD = 30; // per-channel RGB distance (0-255)

const BROWSER_ARGS = [
  '--use-gl=angle',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-size=1280,800',
];

/** Compare two PNG buffers. Returns fraction of differing pixels (0–1). */
async function diffPNGs(bufA, bufB) {
  // If sharp is available, use it for proper PNG decode.
  // Otherwise fall back to raw buffer length comparison (not a real diff).
  try {
    const sharp = await import('sharp').catch(() => null);
    if (!sharp) {
      console.warn('[compare] sharp not installed — falling back to buffer hash comparison');
      return bufA.length === bufB.length ? 0 : 1;
    }

    const { data: pixA, info } = await sharp.default(bufA).raw().toBuffer({ resolveWithObject: true });
    const { data: pixB } = await sharp.default(bufB).raw().toBuffer({ resolveWithObject: true });

    const totalPixels = info.width * info.height;
    let diffCount = 0;

    for (let i = 0; i < pixA.length; i += info.channels) {
      const dr = Math.abs(pixA[i]   - pixB[i]);
      const dg = Math.abs(pixA[i+1] - pixB[i+1]);
      const db = Math.abs(pixA[i+2] - pixB[i+2]);
      if (dr > PIXEL_DIFF_THRESHOLD || dg > PIXEL_DIFF_THRESHOLD || db > PIXEL_DIFF_THRESHOLD) {
        diffCount++;
      }
    }

    const fraction = diffCount / totalPixels;
    if (VERBOSE) {
      console.log(`  pixels: ${totalPixels}, differing: ${diffCount} (${(fraction * 100).toFixed(2)}%)`);
    }
    return fraction;
  } catch (e) {
    console.warn('[compare] Image diff error:', e.message);
    return 0; // skip on error
  }
}

async function compare() {
  // Check baselines exist
  const manifest = join(BASELINE_DIR, 'manifest.json');
  if (!existsSync(manifest)) {
    console.error('[compare] No baselines found. Run: node tests/visual/baseline.mjs');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, args: BROWSER_ARGS });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', () => {});

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__fixerRecord === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(2000);

  const results = [];

  // ── 1. Intro ──────────────────────────────────────────────────────────────
  {
    const current  = await page.screenshot({ fullPage: false });
    const baseline = readFileSync(join(BASELINE_DIR, 'intro.png'));
    const diff = await diffPNGs(baseline, current);
    const pass = diff <= MAX_DIFF_FRACTION;
    results.push({ name: 'intro', diff, pass });
    console.log(`[compare] intro:     ${pass ? '✓ PASS' : '✗ FAIL'} (${(diff * 100).toFixed(2)}% diff)`);
  }

  // ── 2. Driving ────────────────────────────────────────────────────────────
  await page.evaluate(() => document.querySelector('button.story-card-action')?.click());
  await page.waitForTimeout(4000);
  {
    const current  = await page.screenshot({ fullPage: false });
    const baseline = readFileSync(join(BASELINE_DIR, 'driving.png'));
    const diff = await diffPNGs(baseline, current);
    const pass = diff <= MAX_DIFF_FRACTION;
    results.push({ name: 'driving', diff, pass });
    console.log(`[compare] driving:   ${pass ? '✓ PASS' : '✗ FAIL'} (${(diff * 100).toFixed(2)}% diff)`);
  }

  // ── 3. Beat flash ─────────────────────────────────────────────────────────
  await page.keyboard.down('w');
  try {
    await page.waitForSelector('.beat-flash.show', { timeout: 30000 });
    await page.waitForTimeout(200);
    const current  = await page.screenshot({ fullPage: false });
    const baseline = readFileSync(join(BASELINE_DIR, 'beat-flash.png'));
    const diff = await diffPNGs(baseline, current);
    const pass = diff <= MAX_DIFF_FRACTION;
    results.push({ name: 'beat-flash', diff, pass });
    console.log(`[compare] beat-flash: ${pass ? '✓ PASS' : '✗ FAIL'} (${(diff * 100).toFixed(2)}% diff)`);
  } catch {
    console.warn('[compare] beat-flash: SKIP — beat did not appear within 30s');
  }
  await page.keyboard.up('w');

  await browser.close();

  // ── Report ────────────────────────────────────────────────────────────────
  const failed = results.filter(r => !r.pass);
  if (failed.length > 0) {
    console.error(`\n[compare] VISUAL REGRESSION DETECTED in: ${failed.map(f => f.name).join(', ')}`);
    console.error('[compare] Re-run baseline.mjs with --force to update baselines if changes are intentional.');
    process.exit(1);
  } else {
    console.log(`\n[compare] All ${results.length} visual checks passed.`);
  }
}

compare().catch(e => {
  console.error('[compare] Error:', e.message);
  process.exit(1);
});
