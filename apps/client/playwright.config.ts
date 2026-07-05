import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the Observer client. They drive a real browser against
 * the built app, with the WebSocket host replaced by a faithful in-page mock
 * (see e2e/mockHost.js) — so the flows (landing → enter → cameras → Providence →
 * author-a-world → reconnect) are exercised deterministically, without a live
 * server or database. SwiftShader flags let the r3f WebGL canvas mount headless.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec vite --port 4321 --strictPort',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
