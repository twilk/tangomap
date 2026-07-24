import { defineConfig, devices } from '@playwright/test';

/**
 * Opt-in e2e smoke (`npm run e2e`): runs against an ALREADY RUNNING app
 * (dev server or a deployment) pointed at by E2E_BASE_URL — it does not boot
 * one, because the app needs a real database. The specs only use the seeded
 * public dancer handles, read-only.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
