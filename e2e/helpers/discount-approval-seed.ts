/**
 * Seed idempotente para fluxos E2E de aprovação de desconto.
 *
 * Garante a existência de N solicitações pending com `seller_notes` prefixadas
 * por `e2eName()` (vide helpers/e2e-resources). Reutiliza linhas pré-existentes
 * com o mesmo (quote_id, status='pending') graças ao índice UNIQUE parcial
 * criado na migração 20260625162653_* — sem duplicar entre execuções.
 *
 * Uso típico (helper, NÃO um spec — não tem `test()`):
 *   const ids = await seedDiscountApprovalRequests(supabase, { count: 60 });
 *   // ids.length === 60, todos `status='pending'`, prefixo e2e único.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { e2eName } from "./e2e-resources";

export interface SeedOptions {
  count?: number;
  sellerId: string;
  quoteIdFactory: (index: number) => Promise<string> | string;
  maxAllowedPercent?: number;
  requestedPercent?: number;
}

export interface SeedResult {
  id: string;
  quoteId: string;
  createdAt: string;
}

export async function seedDiscountApprovalRequests(
  supabase: SupabaseClient,
  opts: SeedOptions,
): Promise<SeedResult[]> {
  const count = opts.count ?? 5;
  const maxAllowed = opts.maxAllowedPercent ?? 10;
  const requested = opts.requestedPercent ?? 15;
  const results: SeedResult[] = [];

  for (let i = 0; i < count; i++) {
    const quoteId = await opts.quoteIdFactory(i);
    const sellerNotes = `${e2eName(`seed-approval-${i}`)} · auto`;

    // 1) Upsert idempotente: se já existe pending p/ esse quote_id, retorna ele.
    const { data: existing } = await supabase
      .from("discount_approval_requests")
      .select("id, created_at")
      .eq("quote_id", quoteId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      results.push({ id: existing.id, quoteId, createdAt: existing.created_at });
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("discount_approval_requests")
      .insert({
        quote_id: quoteId,
        seller_id: opts.sellerId,
        requested_discount_percent: requested,
        max_allowed_percent: maxAllowed,
        seller_notes: sellerNotes,
        status: "pending",
      })
      .select("id, created_at")
      .single();

    if (error) throw error;
    results.push({ id: inserted.id, quoteId, createdAt: inserted.created_at });
  }

  return results;
}
