// diag-idle — observe the spawn settle with NO input. Screenshots + truck
// position each second for 6s after DRIVE. Catches roll-away and camera
// placement issues without driving dynamics in the way.
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  channel: process.env.PW_BROWSER_CHANNEL || undefined,
  args: ['--use-gl=angle', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--window-size=1280,800'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('console', () => {});
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button.title-incident--open', { timeout: 20000 });
await page.click('button.title-incident--open');
await page.waitForSelector('button.story-card-action', { timeout: 20000 });
await page.click('button.story-card-action');

for (let s = 1; s <= 6; s++) {
  await page.waitForTimeout(1000);
  const p = await page.evaluate(() => window.__fixerTruckPos ?? null);
  console.log(`t=${s}s`, JSON.stringify(p));
  await page.screenshot({ path: `scripts/.verify-shots/idle-${s}s.png` });
}
await browser.close();
