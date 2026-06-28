import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration
 * Suporta múltiplos fluxos: público, autenticado e mobile.
 */
export default defineConfig({
  testDir: './e2e',
  // Apenas specs Playwright. Sem isto, o testMatch padrão também casa arquivos
  // *.test.ts — e o Vitest e2e/scripts/__tests__/generate-fixtures.test.ts
  // importa `vitest`, cujo `expect` colide com o do Playwright no mesmo processo
  // ("Cannot redefine property: Symbol($$jest-matchers-object)"), derrubando a
  // coleta de TODA a suíte de forma intermitente. Projetos com testMatch próprio
  // (setup, chromium-smoke) continuam com o seu.
  testMatch: '**/*.spec.ts',
  timeout: 120 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 5 : 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['github']
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
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
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testIgnore: [/auth\.setup\.ts/],
    },
    {
      name: 'firefox-public',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
      testIgnore: [/auth\.setup\.ts/],
    },
    {
      name: 'webkit-public',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
      testIgnore: [/auth\.setup\.ts/],
    },

    // 3. Projetos Autenticados (reaproveita login do setup)
    {
      name: 'chromium-authed',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: path.resolve('e2e/.auth/storageState.json'),
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/],
    },

    {
      name: 'firefox-authed',
      use: {
        ...devices['Desktop Firefox'],
        storageState: path.resolve('e2e/.auth/storageState.json'),
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/],
    },

    {
      name: 'webkit-authed',
      use: {
        ...devices['Desktop Safari'],
        storageState: path.resolve('e2e/.auth/storageState.json'),
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/],
    },

    // 4. Mobile
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: path.resolve('e2e/.auth/storageState.json'),
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/],
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        storageState: path.resolve('e2e/.auth/storageState.json'),
      },
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/],
    },

    // 5. Smoke — serial, no auth, no retries
    {
      name: 'chromium-smoke',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: [/smoke\.spec\.ts/],
      retries: 0,
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
