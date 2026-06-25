/**
 * Seed via Page — cria solicitações pending de desconto reutilizando a sessão
 * admin já hidratada no localStorage do browser. Idempotente: pula quotes que
 * já possuem `status='pending'` (índice UNIQUE parcial garante).
 *
 * Retorna a contagem total de pending após o seed. Sem efeitos colaterais se
 * faltar JWT (retorna 0). Não lança em RLS denied — apenas registra no console.
 */
import type { Page } from "@playwright/test";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

export interface PageSeedOptions {
  /** Quantidade mínima desejada de requests pending na fila. */
  minPending?: number;
  /** Prefixo único deste run para `seller_notes` (default: timestamp). */
  notesPrefix?: string;
}

export interface PageSeedResult {
  created: number;
  pendingTotal: number;
  skipped: string | null;
}

export async function seedDiscountApprovalRequestsFromPage(
  page: Page,
  opts: PageSeedOptions = {},
): Promise<PageSeedResult> {
  const minPending = opts.minPending ?? 55;
  const notesPrefix = opts.notesPrefix ?? `e2e-seed-${Date.now()}`;

  return await page.evaluate(
    async ({ url, anonKey, minPending, notesPrefix }) => {
      // 1) JWT do admin via localStorage (chave gerada pelo Supabase JS).
      let jwt = "";
      let sellerId = "";
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!;
          if (!k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          jwt = parsed?.access_token ?? "";
          sellerId = parsed?.user?.id ?? "";
          if (jwt) break;
        }
      } catch {
        /* noop */
      }
      if (!jwt || !sellerId) {
        return { created: 0, pendingTotal: 0, skipped: "no-admin-jwt" };
      }

      const headers: Record<string, string> = {
        apikey: anonKey,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      };

      // 2) Quantos pending já existem?
      const countResp = await fetch(
        `${url}/rest/v1/discount_approval_requests?select=id&status=eq.pending`,
        { headers: { ...headers, Prefer: "count=exact" } },
      );
      const contentRange = countResp.headers.get("content-range") ?? "0-0/0";
      const pendingBefore = Number(contentRange.split("/")[1] ?? "0");
      if (pendingBefore >= minPending) {
        return { created: 0, pendingTotal: pendingBefore, skipped: null };
      }

      // 3) Buscar quotes existentes que ainda não tenham request pending.
      const needed = minPending - pendingBefore;
      const quotesResp = await fetch(
        `${url}/rest/v1/quotes?select=id&order=created_at.desc&limit=${needed * 2}`,
        { headers },
      );
      if (!quotesResp.ok) {
        return { created: 0, pendingTotal: pendingBefore, skipped: "no-quotes-rls" };
      }
      const quotes: Array<{ id: string }> = await quotesResp.json();
      if (quotes.length === 0) {
        return { created: 0, pendingTotal: pendingBefore, skipped: "no-quotes-available" };
      }

      // 4) Filtrar quotes que já têm pending request.
      const idsParam = quotes.map((q) => q.id).join(",");
      const existingResp = await fetch(
        `${url}/rest/v1/discount_approval_requests?select=quote_id&status=eq.pending&quote_id=in.(${idsParam})`,
        { headers },
      );
      const existing: Array<{ quote_id: string }> = existingResp.ok
        ? await existingResp.json()
        : [];
      const taken = new Set(existing.map((r) => r.quote_id));
      const candidates = quotes.filter((q) => !taken.has(q.id)).slice(0, needed);
      if (candidates.length === 0) {
        return { created: 0, pendingTotal: pendingBefore, skipped: "all-quotes-have-pending" };
      }

      // 5) Inserir em lote.
      const payload = candidates.map((q, i) => ({
        quote_id: q.id,
        seller_id: sellerId,
        requested_discount_percent: 15,
        max_allowed_percent: 10,
        seller_notes: `${notesPrefix}-${i}`,
        status: "pending",
      }));
      const insertResp = await fetch(`${url}/rest/v1/discount_approval_requests`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!insertResp.ok) {
        return { created: 0, pendingTotal: pendingBefore, skipped: `insert-failed-${insertResp.status}` };
      }
      const inserted = (await insertResp.json()) as unknown[];
      return {
        created: inserted.length,
        pendingTotal: pendingBefore + inserted.length,
        skipped: null,
      };
    },
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, minPending, notesPrefix },
  );
}
