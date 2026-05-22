/**
 * E2E Test Configuration — Playwright
 *
 * Estrutura:
 *  - project "setup": roda e2e/fixtures/auth.setup.ts UMA VEZ e gera storageState.json
 *  - project "chromium-public": specs sem auth (login, públicos)
 *  - project "chromium-authed": specs autenticados (depende de setup)
 *
 * Hardening anti-flake:
 *  - headless POR PADRÃO (sobrescrevível por --headed ou E2E_HEADLESS=false)
 *  - retries controlados: CI=2, local=1 (override por E2E_RETRIES=N)
 *  - expect.timeout escalonado: 15s local / 45s CI (absorve hidratação SPA pesada)
 *  - reducedMotion: "reduce" para neutralizar animações (Radix/framer-motion)
 *  - testIdAttribute padronizado em "data-testid"
 *
 * Comandos:
 *   npm run test:e2e          # headless (default)
 *   npm run test:e2e:ui       # modo visual
 *   npm run test:e2e:headed   # browser visível
 *   npm run test:e2e:debug    # com inspector
 *   npm run test:e2e:report   # abre o relatório HTML
 *
 * Envs:
 *   E2E_BASE_URL    URL do servidor já rodando (pula webServer)
 *   E2E_HEADLESS    "false" para forçar headed; default true
 *   E2E_RETRIES     número absoluto de retries (sobrescreve CI/local)
 */
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE = path.resolve(__dirname, "e2e/.auth/storageState.json");
const ARTIFACTS_DIR = path.resolve(__dirname, "e2e-artifacts");

const HEADLESS = process.env.E2E_HEADLESS
  ? process.env.E2E_HEADLESS.toLowerCase() !== "false"
  : true;

const RETRIES = process.env.E2E_RETRIES
  ? Math.max(0, Number.parseInt(process.env.E2E_RETRIES, 10) || 0)
  : process.env.CI
    ? 2
    : 1;

export default defineConfig({
  testDir: "./e2e",
  // Restrict to *.spec.ts only — prevents Playwright from loading vitest
  // unit tests (*.test.ts) that live inside e2e/scripts/__tests__/ and
  // cause "Cannot redefine property: Symbol($$jest-matchers-object)" when
  // @vitest/expect conflicts with Playwright's already-initialized matchers.
  testMatch: /.*\.spec\.ts/,
  globalSetup: path.resolve(__dirname, "e2e/global-setup.ts"),
  globalTeardown: path.resolve(__dirname, "e2e/global-teardown.ts"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: RETRIES,
  workers: process.env.CI ? 1 : undefined,
  // CI dobra o per-test timeout para absorver teardown lento do browser context
  // em rotas com ProtectedRoute (effects pendentes fazem context.close atrasar).
  // Local mantém 45s para detectar regressões cedo.
  timeout: process.env.CI ? 90_000 : 45_000,
  // CI dobra+ todos os timeouts para absorver hidratação SPA pesada (~10s
  // de parse/eval JS no primeiro acesso à rota, mesmo após bundle pronto).
  // Local mantém valores originais para detectar regressões reais cedo.
  expect: { timeout: process.env.CI ? 45_000 : 15_000 },
  outputDir: ARTIFACTS_DIR,
  // JSON reporter sempre emitido para alimentar `scripts/e2e-feature-summary.mjs`
  // (overhead desprezível). HTML aberto on-demand via `npm run test:e2e:report`.
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
        ["json", { outputFile: "playwright-report/results.json" }],
        ["junit", { outputFile: "playwright-report/results.xml" }],
      ]
    : [
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
        ["json", { outputFile: "playwright-report/results.json" }],
      ],
  use: {
    // Vite dev server roda em :8080 (vite.config.ts → server.port).
    // Default antigo 5173 não foi propagado quando o projeto migrou para 8080
    // — fazia o webServer wait timeoutar após 120s. Root cause da #167.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    headless: HEADLESS,
    testIdAttribute: "data-testid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: process.env.CI ? 30_000 : 10_000,
    navigationTimeout: process.env.CI ? 45_000 : 20_000,
    reducedMotion: "reduce",
    launchOptions: {
      args: ["--disable-blink-features=AutomationControlled"],
    },
  },
  // ───────────────────────────────────────────────────────────
  // ISOLAMENTO @smoke (defesa em profundidade)
  //
  // Apenas o project `chromium-smoke` executa testes marcados `@smoke`.
  // Demais projects aplicam `grepInvert: /@smoke/` para ignorar qualquer
  // `@smoke` que vaze para outro arquivo (ex.: alguém adicionar
  // `test.describe("@smoke ...")` num spec de regression por engano).
  //
  // Combinado com `testMatch`/`testIgnore` por path, isso garante 3 camadas:
  //   1. Path-based: smoke spec só casa em `chromium-smoke`.
  //   2. Tag-based:  qualquer `@smoke` em outro spec é silenciosamente
  //                  pulado em todos os outros projects.
  //   3. Comando:    `npm run test:e2e` (geral) NÃO inclui chromium-smoke
  //                  por padrão — vide `npm run test:e2e:all` para encadear.
  // ───────────────────────────────────────────────────────────
  projects: [
    {
      name: "setup",
      testMatch: /fixtures\/auth\.setup\.ts/,
    },
    {
      // Theme & Accessibility Gate — valida contraste WCAG, tipografia e
      // visual regression para cada preset × mode em `THEME_PRESETS`.
      // Project dedicado porque `chromium-public` ignora explicitamente
      // `theme-validation.spec.ts` no testIgnore. Sem este project, o
      // `npm run test:theme-validation` retornava "No tests found".
      name: "theme-validation",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /theme-validation\.spec\.ts/,
      grepInvert: /@smoke/,
    },
    {
      name: "chromium-public",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/fixtures\/auth\.setup\.ts/, /flows\//, /routes\//, /theme-validation\.spec\.ts/],
      grepInvert: /@smoke/,
    },
    {
      name: "chromium-wizard",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [
        /quote-builder-wizard\.spec\.ts/, 
        /quote-builder-shipping-validation\.spec\.ts/,
        /company-search-history\.spec\.ts/,
        /quote-builder-personalization-ux\.spec\.ts/
      ],
    },
    {
      name: "chromium-authed",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      testMatch: /flows\/.*\.spec\.ts/,
      // Smoke roda no project dedicado abaixo (chromium-smoke) para evitar
      // execução duplicada e garantir ordem sequencial determinística.
      testIgnore: [/flows\/20-all-features-smoke\.spec\.ts/],
      grepInvert: /@smoke/,
    },
    {
      // Smoke gate — 1 teste por funcionalidade, ordem fixa, workers=1.
      // SEM retries: gate determinístico — flakiness deve falhar visível.
      // Executar isoladamente: `npm run test:e2e:smoke` ou
      // `npx playwright test --project=chromium-smoke --max-failures=3`.
      name: "chromium-smoke",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
        // Captura forçada por teste em falhas — independente do default global.
        // Garante diagnóstico visual completo no CI sem depender de retries.
        screenshot: { mode: "only-on-failure", fullPage: true },
        video: { mode: "retain-on-failure", size: { width: 1280, height: 720 } },
        trace: "retain-on-failure",
      },
      dependencies: ["setup"],
      testMatch: /flows\/(20-all-features-smoke|22-google-oauth-smoke|23-rocket-animation-snapshot|24-visual-regression-stars)\.spec\.ts/,
      // Exige tag @smoke explícita — qualquer test() sem a tag no
      // describe é ignorado, mesmo no spec do smoke. Garante que apenas
      // testes intencionalmente marcados @smoke rodem aqui.
      grep: /@smoke/,
      fullyParallel: false,
      workers: 1,
      retries: 0,
    },
    {
      // Specs por rota — área pública (sem auth). Ex.: routes/public/*.spec.ts
      name: "routes-public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /routes\/public\/.*\.spec\.ts/,
      grepInvert: /@smoke/,
    },
    {
      // Specs por rota — áreas autenticadas (app, quotes, admin).
      name: "routes-authed",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      testMatch: /routes\/(app|quotes|admin)\/.*\.spec\.ts/,
      grepInvert: /@smoke/,
    },
    {
      // Versão mobile dos mesmos specs (apenas testes marcados @mobile rodam aqui).
      name: "routes-mobile",
      use: { ...devices["iPhone 13"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      testMatch: /routes\/(app|quotes|admin)\/.*\.spec\.ts/,
      grep: /@mobile/,
      grepInvert: /@smoke/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "npx vite" : "npm run dev",
        url: "http://localhost:8080",
        // Always reuse an existing server if one is already listening.
        // In CI, multiple `npx playwright test` invocations (smoke,
        // header-sticky, regression) run sequentially; without this, the
        // second invocation fails immediately when port 8080 is still held
        // by the prior step's Vite process during its shutdown window.
        reuseExistingServer: true,
        timeout: 300_000,
        stdout: "pipe",
        stderr: "pipe",
        // Supabase-js v2 throws "supabaseUrl is required." when env vars are
        // undefined. In CI without a .env file, inject placeholder values so
        // the Vite subprocess (and the built app) can initialize the client.
        // These values only reach the Vite process — the Playwright test
        // runner's process.env is unaffected, so test-94's skip guard
        // (process.env.VITE_SUPABASE_URL) still fires correctly.
        env: process.env.CI
          ? {
              ...process.env,
              VITE_SUPABASE_URL:
                process.env.VITE_SUPABASE_URL ?? "https://placeholder.supabase.co",
              VITE_SUPABASE_PUBLISHABLE_KEY:
                process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "placeholder-anon-key",
            }
          : undefined,
      },
});
