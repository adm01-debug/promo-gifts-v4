/**
 * Seed unificado para deep-link de notificações de desconto.
 *
 * Garante:
 *   - Pelo menos 1 request pending (via seedDiscountApprovalRequestsFromPage).
 *   - Retorna `firstPendingId` para uso direto em /admin/aprovacoes-desconto/:id
 *     sem depender de DOM ou texto.
 *
 * Reutilizado por specs 04c6 (drawer de notificações) e qualquer outro spec
 * que precise abrir o detalhe de um pedido pendente real.
 */
import type { Page, TestInfo } from "@playwright/test";
import { setupDiscountAdmin } from "./setup-discount-admin";
import { DiscountApprovalPO } from "./discount-approval-po";

export interface DeeplinkSeedResult {
  firstPendingId: string | null;
  seedSkipped: string | null;
}

export async function seedDiscountDeeplink(
  page: Page,
  testInfo: TestInfo,
  opts: { minPending?: number } = {},
): Promise<DeeplinkSeedResult> {
  const { seed } = await setupDiscountAdmin(page, testInfo, {
    minPending: opts.minPending ?? 1,
  });
  const po = new DiscountApprovalPO(page);
  await po.openQueue();
  const firstPendingId = await po.firstPendingId();
  return { firstPendingId, seedSkipped: seed.skipped };
}
