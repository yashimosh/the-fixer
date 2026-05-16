// Playwright configuration for The Fixer e2e + perf tests.
//
// Requires the dev server to be running: `npm run dev` (port 5173).
// Tests are NOT run in CI by default (they need a running game + browser).
// Run manually: npx playwright test
//
// Browser: Chromium with --use-gl=angle flag to force GPU rendering.
// This is critical: default headless mode renders WebGL without GPU, which
// produces incorrect colours and causes visual assertions to fail. ANGLE
// software rasterizer is more consistent than full headless WebGL.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,           // single test limit — full run takes 60s
  retries: 1,                // one retry on flake (physics timing varies slightly)
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',
    // headless: false gives access to real GPU compositing.
    // headless mode strips WebGL GPU acceleration; colours and physics differ.
    headless: false,
    launchOptions: {
      args: [
        '--use-gl=angle',                      // force ANGLE software GL (consistent)
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--window-size=1280,800',
      ],
    },
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer config — dev server is started manually.
  // This keeps the CI model simple: dev server is a separate process.
});
