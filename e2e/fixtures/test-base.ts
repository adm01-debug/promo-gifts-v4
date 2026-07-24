/**
 * Test base estendendo o Playwright com:
 *  - Captura automática de console/pageerror em toda página
 *  - afterEach que dispara coleta de evidências em qualquer falha
 *  - Helper `requireAuth()` que pula o teste se as credenciais não foram dadas
 *  - Fixture `e2eResources` com sub-prefixo POR SPEC e cleanup escopado
 *    em caso de falha — evita que um spec apague recursos vivos de outro
 *    spec rodando em paralelo no mesmo worker/CI.
 *
 * Uso:
 *   import { test, expect } from "../fixtures/test-base";
 *
 *   test("...", async ({ page, resources }) => {
 *     const { name } = await resources.createQuote({ label: "approval", submit: true });
 *     // ...
 *   });
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const STORAGE_STATE = path.resolve(_dirname, "../.auth/storageState.json");

import { attachConsoleCapture, type EvidenceCollector } from "../helpers/evidence";
import { loadCleanupConfig, purgeAll } from "../helpers/cleanup-client";
import { e2eScope } from "./test-user";
import {
  createE2eQuote,
  createE2eCollection,
  createE2eFavoriteList,
  createE2eCartTemplate,
  createE2eCustomKit,
  createE2eSupplier,
  createE2eTechnique,
} from "../helpers/e2e-resources";

interface CreateOpts {
  label?: string;
  submit?: boolean;
}

export interface E2eResources {
  /** Sub-prefixo derivado do basename do arquivo do spec, ex.: `[E2E:quote-create]`. */
  prefix: string;
  createQuote: (opts?: CreateOpts) => Promise<{ name: string }>;
  createCollection: (opts?: CreateOpts) => Promise<{ name: string }>;
  createFavoriteList: (opts?: CreateOpts) => Promise<{ name: string }>;
  createCartTemplate: (opts?: CreateOpts) => Promise<{ name: string }>;
  createCustomKit: (opts?: CreateOpts) => Promise<{ name: string }>;
  createSupplier: (opts?: CreateOpts) => Promise<{ name: string }>;
  createTechnique: (opts?: CreateOpts) => Promise<{ name: string }>;
}

type Fixtures = {
  evidence: EvidenceCollector;
  resources: E2eResources;
  /**
   * Auto-fixture: em falha, dispara purge ESCOPADO ao prefixo do spec
   * (não toca em recursos de outros specs paralelos). Pode ser desligada
   * via `E2E_CLEANUP_ON_FAILURE=0`.
   */
  cleanupOnFailure: void;
};

function deriveSpecSlug(filePath: string): string {
  return path.basename(filePath).replace(/\.spec\.tsx?$/, "");
}

export const test = base.extend<Fixtures>({
  evidence: async ({ page }, use, testInfo) => {
    const collector = attachConsoleCapture(page);
    await use(collector);

    // Fail test if console errors or critical warnings were captured
    const errors = collector.pageErrors.map(e => e.message);
    const consoleErrors = collector.consoleLogs
      .filter(l => l.type === 'error' && !l.text.includes('chrome-extension'))
      .map(l => l.text);
    
    const allErrors = [...errors, ...consoleErrors];
    if (allErrors.length > 0) {
      throw new Error(`Test failed due to console errors:\n${allErrors.join('\n')}`);
    }

    // Fail on critical warnings
    const criticalWarnings = collector.consoleLogs
      .filter(l => l.type === 'warning' && (
        l.text.includes('React') || 
        l.text.includes('Supabase') || 
        l.text.includes('Invalid') ||
        l.text.includes('Failed')
      ))
      .map(l => l.text);

    if (criticalWarnings.length > 0) {
      throw new Error(`Test failed due to critical console warnings:\n${criticalWarnings.join('\n')}`);
    }

    if (testInfo.status !== testInfo.expectedStatus) {
      await collector.attachAll(page, testInfo);
    }
  },

  resources: async ({ page }, use, testInfo) => {
    const slug = deriveSpecSlug(testInfo.file);
    const prefix = e2eScope(slug);
    const api: E2eResources = {
      prefix,
      createQuote: (o = {}) => createE2eQuote(page, { ...o, prefix }),
      createCollection: (o = {}) => createE2eCollection(page, { ...o, prefix }),
      createFavoriteList: (o = {}) => createE2eFavoriteList(page, { ...o, prefix }),
      createCartTemplate: (o = {}) => createE2eCartTemplate(page, { ...o, prefix }),
      createCustomKit: (o = {}) => createE2eCustomKit(page, { ...o, prefix }),
      createSupplier: (o = {}) => createE2eSupplier(page, { ...o, prefix }),
      createTechnique: (o = {}) => createE2eTechnique(page, { ...o, prefix }),
    };
    await use(api);
  },

  cleanupOnFailure: [
    async ({ resources }, use, testInfo) => {
      // Setup: Limpa recursos ANTES do teste para garantir isolamento
      const cfg = loadCleanupConfig();
      if (cfg && process.env.E2E_CLEANUP_ON_START !== "0") {
        await purgeAll(cfg, {
          quiet: true,
          reason: `setup:${testInfo.title}`,
          nameFilterPrefix: resources.prefix,
        }).catch(() => {});
      }

      await use();

      // Teardown: Limpa recursos APÓS o teste se passar
      if (cfg && (testInfo.status === testInfo.expectedStatus || process.env.E2E_CLEANUP_ALWAYS === "1")) {
        await purgeAll(cfg, {
          quiet: true,
          reason: `teardown:${testInfo.title}`,
          nameFilterPrefix: resources.prefix,
        }).catch(() => {});
      }
    },
    { auto: true },
  ],
});

export { expect };

/** Retorna true se o storageState gravado por auth.setup tem cookies reais. */
function authStorageHasCookies(): boolean {
  try {
    const raw = fs.readFileSync(STORAGE_STATE, "utf-8");
    const state = JSON.parse(raw) as { cookies?: unknown[] };
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}

/** Marca o teste como skip se as credenciais E2E_USER_* não foram fornecidas
 *  OU se o auth.setup falhou (login inválido, Supabase indisponível, etc.).
 *
 *  BYPASS: quando `E2E_MOCK_AUTH=1`, aceitamos o storageState sintético
 *  gerado por `scripts/e2e-mock-auth-setup.mjs` — que grava um cookie
 *  sentinela `e2e-mock-auth`. Nesse modo, os specs precisam chamar
 *  `installMockAuth(page)` (em `e2e/helpers/mock-auth.ts`) para interceptar
 *  as chamadas a `/auth/v1/**`. */
export function requireAuth(reason = "E2E_USER_EMAIL/PASSWORD não configurados") {
  const mockMode = process.env.E2E_MOCK_AUTH === "1" || process.env.E2E_MOCK_AUTH === "true";
  if (mockMode) {
    // Em modo mock só exigimos que o storageState exista com cookies (o
    // script mock-auth-setup grava a sentinela).
    test.skip(
      !authStorageHasCookies(),
      "E2E_MOCK_AUTH=1 mas storageState mock não foi gerado. Rode `node scripts/e2e-mock-auth-setup.mjs` antes.",
    );
    return;
  }
  const hasCredentials = !!(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);
  if (!hasCredentials) {
    test.skip(true, reason);
    return;
  }
  test.skip(
    !authStorageHasCookies(),
    "Auth setup falhou — credenciais inválidas ou Supabase indisponível",
  );
}

/** Marca o teste como skip se as credenciais admin não foram fornecidas. */
export function requireAdmin(reason = "E2E_ADMIN_EMAIL/PASSWORD não configurados") {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    reason,
  );
}
