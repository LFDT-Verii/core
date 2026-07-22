import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-functional',
  timeout: 45000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.WALLET_CERTIFIER_URL ?? 'http://localhost:14080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
