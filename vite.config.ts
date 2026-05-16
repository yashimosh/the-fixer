import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest configuration — only used when running `npm test`.
  // Separate from Playwright e2e (which needs a running dev server + browser).
  test: {
    environment: 'node',   // pure-TS tests; no DOM needed for terrainFn, incidents
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/vite-env.d.ts'],
    },
  },
})
