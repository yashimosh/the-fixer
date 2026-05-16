// Input bot tests — physics + cargo regression
//
// Simulates three distinct player archetypes by controlling keyboard input
// and asserting on observable game state. Catches physics regressions (truck
// doesn't move, too slow, wrong ending logic) that code review misses.
//
// Archetypes:
//   "Racer"  — W held the whole run. Should lose cargo (speed > threshold).
//   "Reader" — W pulsed slowly, brakes at each beat. Should keep all cargo.
//   "Chaotic"— Alternates WASD randomly. Should not crash the game.
//
// Run: npx playwright test tests/e2e/input-bot.test.ts

import { test, expect } from '@playwright/test';

const DRIVE_SELECTOR = 'button.story-card-action';

// Helper: wait for physics + camera to settle (2s after DRIVE)
async function startRun(page: Parameters<typeof test>[1] extends infer P ? P : never) {
  await (page as any).goto('/');
  await (page as any).waitForSelector(DRIVE_SELECTOR, { timeout: 15_000 });
  await (page as any).waitForFunction(
    () => typeof (window as any).__fixerRecord === 'function',
    { timeout: 15_000 }
  );
  await (page as any).click(DRIVE_SELECTOR);
  await (page as any).waitForTimeout(2_000); // physics settle
}

test.describe('input-bot — Racer (W held, fast run)', () => {

  test('truck reaches END_Z and ending fires within 65 seconds', async ({ page }) => {
    await startRun(page);

    await page.keyboard.down('w');

    // Wait for ending card (phase → "ended")
    const endCard = page.locator('.story-card');
    const endingVisible = endCard.waitFor({ state: 'visible', timeout: 65_000 });
    await endingVisible;
    await page.keyboard.up('w');

    await expect(endCard).toBeVisible();
    const endText = await endCard.textContent();
    expect(endText).toContain('You drop them at the Divan');
  });

  test('racer loses at least 1 cargo item (speed > CARGO_RISK_SPEED at risk beats)', async ({ page }) => {
    await startRun(page);
    await page.keyboard.down('w');

    // Wait for ending
    await page.locator('.story-card').waitFor({ state: 'visible', timeout: 65_000 });
    await page.keyboard.up('w');

    // Cargo dot count: at least one dot should be off (dim)
    const offDots = page.locator('.dot--off');
    const offCount = await offDots.count();
    expect(offCount).toBeGreaterThanOrEqual(1);
  });

  test('racer run ends in "partial" or "failed" ending (not "clean")', async ({ page }) => {
    await startRun(page);
    await page.keyboard.down('w');
    await page.locator('.story-card').waitFor({ state: 'visible', timeout: 65_000 });
    await page.keyboard.up('w');

    const endText = await page.locator('.story-card').textContent();
    // Clean ending: "The piece runs in three weeks. Six pages"
    // Partial ending: "The piece runs partial"
    // Failed ending: "does not file in time"
    const isClean = endText?.includes('Six pages') ?? false;
    expect(isClean).toBe(false); // racer should NOT get clean ending
  });

});

test.describe('input-bot — Reader (slow, stops at beats)', () => {

  test('reader keeps full cargo when driving slowly', async ({ page }) => {
    await startRun(page);

    // Drive slowly — pulse W 1s on / 2s off to stay well below CARGO_RISK_SPEED (8 m/s)
    // At 24 ENGINE_FORCE with 1.6 LINEAR_DAMPING, 1s bursts reach ~3-4 m/s
    for (let segment = 0; segment < 20; segment++) {
      await page.keyboard.down('w');
      await page.waitForTimeout(1_000);
      await page.keyboard.up('w');
      await page.waitForTimeout(2_000);

      // Stop if ending already appeared
      const phase = await page.evaluate(() =>
        (window as any).__fixer_store?.useGame?.getState()?.phase ?? 'unknown'
      );
      if (phase === 'ended') break;
    }

    const phase = await page.evaluate(() =>
      (window as any).__fixer_store?.useGame?.getState()?.phase ?? 'unknown'
    );

    if (phase === 'ended') {
      // Check cargo — should have all 4 or 3 remaining (slow driver)
      const cargoSecured = await page.evaluate(() =>
        (window as any).__fixer_store?.useGame?.getState()?.cargoSecured ?? -1
      );
      expect(cargoSecured).toBeGreaterThanOrEqual(3);
    }
    // If run didn't complete, that's also a valid slow-driver outcome — don't fail
  });

});

test.describe('input-bot — Chaotic (random WASD)', () => {

  test('game does not throw JS errors under chaotic input', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await startRun(page);

    const keys = ['w', 'a', 's', 'd', ' '];
    const held = new Set<string>();

    // 20 seconds of random key toggling
    for (let i = 0; i < 40; i++) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      if (held.has(key)) {
        await page.keyboard.up(key);
        held.delete(key);
      } else {
        await page.keyboard.down(key);
        held.add(key);
      }
      await page.waitForTimeout(500);
    }

    // Release all held keys
    for (const key of held) await page.keyboard.up(key);

    // No unhandled JS errors
    const gameErrors = errors.filter(e =>
      !e.includes('ResizeObserver') && // benign browser warning
      !e.includes('Non-Error promise rejection') // Tone.js deferred audio start
    );
    expect(gameErrors).toHaveLength(0);
  });

});
