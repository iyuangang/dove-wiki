import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4186/dove-wiki/',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [320, 390, 768, 1280].map(width => ({ name: `chromium-${width}`, use: { browserName: 'chromium', viewport: { width, height: 900 } } })),
  webServer: {
    command: 'npm run preview -- --port 4186 --strictPort',
    url: 'http://127.0.0.1:4186/dove-wiki/',
    env: { VITE_BASE_PATH: '/dove-wiki/' },
    reuseExistingServer: false,
  },
})
