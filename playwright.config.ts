import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration
 * Suporta múltiplos fluxos: público, autenticado e mobile.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Set to 1 to avoid resource issues
  reporter: [
    ['html'],
    ['list']
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },

  projects: [
    // 1. Setup - gera storageState.json
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // 2. Projetos Públicos (sem storageState)
    {
      name: 'chromium-public',
      use: { 
        viewport: { width: 1280, height: 720 },
      },
      testIgnore: [/auth\.setup\.ts/],
    },

    // 3. Projetos Autenticados (reaproveita login do setup)
    {
      name: 'chromium-authed',
      use: {
        viewport: { width: 1280, height: 720 },
        storageState: path.resolve('e2e/.auth/storageState.json'),
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/],
    },

    // 4. Mobile
    {
      name: 'routes-mobile',
      use: { 
        viewport: { width: 375, height: 667 },
        isMobile: true,
      },
      testIgnore: [/auth\.setup\.ts/],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
