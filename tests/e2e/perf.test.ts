// Performance regression tests — Three.js renderer metrics
//
// Asserts that key render-budget metrics stay within thresholds after each
// commit. A sudden spike in draw calls or memory usually means an accidental
// geometry explosion (instancing removed, materials not shared, etc.).
//
// Metrics captured via Three.js renderer.info + Web Performance API.
// These run against the live dev server, so they measure actual runtime cost
// rather than bundle-analysis estimates.
//
// Thresholds (tuned to the current scene complexity, 2026-05-16):
//   Draw calls: ≤ 250   (current ~130; headroom for scenery growth)
//   Triangles:  ≤ 80000 (current ~35000; flat-shaded terrain + scenery)
//   JS heap:    ≤ 60 MB (current ~28 MB at steady state)
//   FPS sample: ≥ 30    (software renderer floor; real GPU >> this)
//
// Run: npx playwright test tests/e2e/perf.test.ts

import { test, expect } from '@playwright/test';

const DRIVE_SELECTOR = 'button.story-card-action';

interface RendererInfo {
  drawCalls: number;
  triangles: number;
  points:    number;
  lines:     number;
  textures:  number;
}

interface PerfSnapshot {
  renderer: RendererInfo;
  heapMB:   number;
  fps:      number;
}

// Capture renderer.info from the R3F canvas via window globals.
// The capture helper exposes __fixerRendererInfo (injected in captureHelper.ts).
async function capturePerf(page: any): Promise<PerfSnapshot> {
  return page.evaluate(async (): Promise<PerfSnapshot> => {
    // Measure FPS over 30 frames
    let frames = 0;
    const start = performance.now();
    await new Promise<void>(resolve => {
      function tick() {
        frames++;
        if (frames < 30) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    const elapsed = performance.now() - start;
    const fps = Math.round((frames / elapsed) * 1000);

    // Renderer info exposed by captureHelper or read directly
    const info = (window as any).__fixerRendererInfo ?? {
      drawCalls: -1,
      triangles: -1,
      points:    0,
      lines:     0,
      textures:  -1,
    };

    const heapMB = ((performance as any).memory?.usedJSHeapSize ?? 0) / 1_048_576;

    return { renderer: info, heapMB: Math.round(heapMB), fps };
  });
}

test.describe('perf — scene budget', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(DRIVE_SELECTOR, { timeout: 15_000 });
    await page.waitForFunction(
      () => typeof (window as any).__fixerRecord === 'function',
      { timeout: 15_000 }
    );
    await page.click(DRIVE_SELECTOR);
    await page.waitForTimeout(3_000); // let physics settle + camera reach truck
  });

  test('draw calls stay under 250 at scene start', async ({ page }) => {
    const snap = await capturePerf(page);
    console.log('[perf] draw calls:', snap.renderer.drawCalls);
    if (snap.renderer.drawCalls === -1) {
      console.warn('[perf] renderer.info not available — captureHelper not exposing it');
      return; // graceful skip if hook not wired
    }
    expect(snap.renderer.drawCalls).toBeLessThanOrEqual(250);
  });

  test('triangle count stays under 80,000', async ({ page }) => {
    const snap = await capturePerf(page);
    console.log('[perf] triangles:', snap.renderer.triangles);
    if (snap.renderer.triangles === -1) return;
    expect(snap.renderer.triangles).toBeLessThanOrEqual(80_000);
  });

  test('JS heap under 60 MB at scene start', async ({ page }) => {
    const snap = await capturePerf(page);
    console.log('[perf] heap:', snap.heapMB, 'MB');
    if (snap.heapMB === 0) return; // performance.memory not available in this browser
    expect(snap.heapMB).toBeLessThanOrEqual(60);
  });

  test('FPS sample ≥ 30 frames/sec (software renderer floor)', async ({ page }) => {
    const snap = await capturePerf(page);
    console.log('[perf] fps sample:', snap.fps);
    expect(snap.fps).toBeGreaterThanOrEqual(30);
  });

});
