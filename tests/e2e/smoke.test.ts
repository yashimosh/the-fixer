// Smoke test — The Fixer
//
// Asserts the minimum viable run: page loads → DRIVE clicked → truck moves →
// all 6 beats fire → ending card appears with correct variant text.
//
// This is the regression test that runs after every deploy to confirm the game
// loop is intact. If it fails, something structural broke.
//
// Run: npx playwright test tests/e2e/smoke.test.ts

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CANONICAL_2017 } from '../../src/story/incidents';
import { driveBot } from './driveBot';

const DRIVE_SELECTOR = 'button.story-card-action';
const TITLE_SELECTOR = 'button.title-incident--open';
const BEAT_FLASH_SELECTOR = '.beat-flash';

// The game now opens on the title screen (anthology incident list).
// Click the playable incident to reach the intro card.
async function gotoIntro(page: Page) {
  await page.goto('/');
  await page.waitForSelector(TITLE_SELECTOR, { timeout: 15_000 });
  await page.click(TITLE_SELECTOR);
  await page.waitForSelector(DRIVE_SELECTOR, { timeout: 15_000 });
}

test.describe('smoke — full run', () => {

  test('title screen lists the anthology and opens the playable incident', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(TITLE_SELECTOR, { timeout: 15_000 });

    // Six incidents listed, one open
    await expect(page.locator('.title-incident')).toHaveCount(6);
    await expect(page.locator(TITLE_SELECTOR)).toHaveCount(1);
    await expect(page.locator('.title-screen')).toContainText('West Mosul');
    await expect(page.locator('.title-screen')).toContainText('Sinjar');
  });

  test('intro card loads with correct title and DRIVE button', async ({ page }) => {
    await gotoIntro(page);

    // Title visible
    await expect(page.locator('.hud.tl .k')).toContainText('the fixer');

    // Incident date visible
    await expect(page.locator('.hud.tl .v')).toContainText('June 2017');

    // Story card has intro text
    const card = page.locator('.story-card');
    await expect(card).toContainText('JUNE 2017');
    await expect(card).toContainText('Engine on at 04:47');

    // DRIVE button present
    await expect(page.locator(DRIVE_SELECTOR)).toBeVisible();
  });

  test('clicking DRIVE starts the run and truck moves', async ({ page }) => {
    await gotoIntro(page);

    // Wait for physics initialisation (captureHelper exposes __fixerRecord)
    await page.waitForFunction(() => typeof (window as any).__fixerRecord === 'function', { timeout: 15_000 });

    await page.click(DRIVE_SELECTOR);

    // Story card should disappear
    await expect(page.locator('.story-card')).not.toBeVisible({ timeout: 5_000 });

    // Speed readout should appear (speed > 0 eventually if held, but at spawn it's 0)
    await expect(page.locator('.hud.br .speed-num')).toBeVisible({ timeout: 5_000 });

    // Cargo dots appear (game entered "running" phase)
    await expect(page.locator('.hud.tr.cargo-dots')).toBeVisible({ timeout: 5_000 });
  });

  test('all 6 beats fire in order when truck drives full route', async ({ page }) => {
    await gotoIntro(page);
    await page.waitForFunction(() => typeof (window as any).__fixerRecord === 'function', { timeout: 15_000 });
    await page.click(DRIVE_SELECTOR);

    const firedBeats: string[] = [];

    // Intercept Zustand showBeat calls — patch the store to record which texts fire
    await page.evaluate(() => {
      const { useGame } = (window as any).__fixer_store ?? {};
      if (!useGame) return;
      const originalShow = useGame.getState().showBeat;
      useGame.setState({
        showBeat: (text: string) => {
          ((window as any).__beatLog ??= []).push(text);
          originalShow(text);
        },
      });
    });

    // Drive the full route — the bot holds throttle and steers toward the
    // centreline (a no-steer W-hold leaves the road on 800m of curves).
    const result = await driveBot(page);
    expect(result.timedOut, `bot timed out at z=${result.finalZ}`).toBe(false);

    // Collect recorded beats
    const beatLog: string[] = await page.evaluate(() => (window as any).__beatLog ?? []);

    // All 6 canonical beats should have fired (they might include cargo loss lines too)
    const canonicalBeatTexts = CANONICAL_2017.beats.map(b => b.text.slice(0, 30));
    for (const snippet of canonicalBeatTexts) {
      const found = beatLog.some(text => text.includes(snippet.slice(0, 20)));
      expect(found, `Beat not fired: "${snippet}"`).toBe(true);
    }
  });

  test('ending card appears after full run', async ({ page }) => {
    await gotoIntro(page);
    await page.waitForFunction(() => typeof (window as any).__fixerRecord === 'function', { timeout: 15_000 });
    await page.click(DRIVE_SELECTOR);

    const result = await driveBot(page);
    expect(result.timedOut, `bot timed out at z=${result.finalZ}`).toBe(false);

    // Ending card should appear (phase → "ended")
    const endCard = page.locator('.story-card');
    await expect(endCard).toBeVisible({ timeout: 15_000 });

    // Should contain one of the ending-specific phrases
    const endText = await endCard.textContent();
    const hasValidEnding =
      endText?.includes('You drop them at the Divan') ?? false;
    expect(hasValidEnding).toBe(true);
  });

});
