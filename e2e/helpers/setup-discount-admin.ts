/**
 * setupDiscountAdmin — fixture compartilhada para os specs 04c5/04c6/04c7.
 *
 * Responsabilidades:
 *   1. Login admin (loginAs) — pula com requireAdmin() se faltam credenciais.
 *   2. Limpa storage antes do seed (isola execuções concorrentes do Playwright).
 *   3. Seed idempotente com prefixo único por teste (testInfo.testId) para
 *      evitar colisão entre workers em paralelo.
 *   4. Retorna metadados do seed para asserts subsequentes.
 */
import type { Page, TestInfo } from "@playwright/test";
import { loginAs } from "./auth";
import { gotoAndSettle } from "./nav";
import {
  seedDiscountApprovalRequestsFromPage,
  type PageSeedResult,
} from "./discount-approval-seed-page";

export interface SetupOptions {
  /** Quantidade mínima de pending a garantir antes do spec rodar. */
  minPending?: number;
  /** Pula limpeza de storage (use quando o login já foi feito antes). */
  skipStorageClear?: boolean;
}

export interface SetupResult {
  seed: PageSeedResult;
  notesPrefix: string;
}

export async function setupDiscountAdmin(
  page: Page,
  testInfo: TestInfo,
  opts: SetupOptions = {},
): Promise<SetupResult> {
  await loginAs(page, "admin");

  if (!opts.skipStorageClear) {
    // Limpa sessionStorage (mantém auth-token em localStorage).
    await page.evaluate(() => {
      try {
        sessionStorage.clear();
      } catch {
        /* noop */
      }
    });
  }

  // Prefixo único por teste — evita colisão entre workers paralelos.
  const notesPrefix = `e2e-${testInfo.project.name}-${testInfo.testId}`;

  // Navega para a fila para hidratar a sessão antes do seed via REST.
  await gotoAndSettle(page, "/admin/usuarios?tab=discounts");

  const seed = await seedDiscountApprovalRequestsFromPage(page, {
    minPending: opts.minPending ?? 1,
    notesPrefix,
  });

  return { seed, notesPrefix };
}
