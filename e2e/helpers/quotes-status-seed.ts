/**
 * Seed determinístico para /orcamentos — garante ≥1 quote em CADA chip
 * (Rascunho, Criado (Não Sinc.), Criado (Sincronizado), Sincronizado,
 *  Pendente, Expirado).
 *
 * Reusa o JWT do admin no `localStorage` (mesmo padrão de
 * `discount-approval-seed-page.ts`). Idempotente: se já houver um quote E2E
 * com a combinação alvo (status + synced_to_bitrix), pula a inserção.
 *
 * Nomes seguem `e2eName(...)` (prefixo `[E2E:*]`) — o `e2e-cleanup` apaga
 * apenas estes registros, nunca dados manuais.
 */
import type { Page } from "@playwright/test";
import { e2eName } from "./e2e-resources";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

interface QuoteSeedTarget {
  label: string;
  status: "draft" | "pending" | "expired";
  synced_to_bitrix: boolean;
}

/** 4 inserções cobrem os 7 chips (all derivado, pending+synced cobre 3 grupos). */
const TARGETS: QuoteSeedTarget[] = [
  { label: "chip-draft", status: "draft", synced_to_bitrix: false },
  { label: "chip-unsynced", status: "pending", synced_to_bitrix: false },
  { label: "chip-created-synced", status: "pending", synced_to_bitrix: true },
  { label: "chip-expired", status: "expired", synced_to_bitrix: false },
];

export interface QuotesStatusSeedResult {
  created: number;
  skipped: string | null;
  names: string[];
}

export async function seedQuotesForStatusChips(
  page: Page,
): Promise<QuotesStatusSeedResult> {
  const targets = TARGETS.map((t) => ({ ...t, name: e2eName(t.label) }));

  return await page.evaluate(
    async ({ url, anonKey, targets }) => {
      // 1) JWT da sessão atual
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
        return { created: 0, skipped: "no-jwt", names: [] as string[] };
      }

      const headers: Record<string, string> = {
        apikey: anonKey,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      };

      let created = 0;
      const names: string[] = [];

      for (const t of targets) {
        // Idempotência: existe quote E2E com (status, synced)?
        const q = new URLSearchParams({
          select: "id",
          status: `eq.${t.status}`,
          synced_to_bitrix: `eq.${t.synced_to_bitrix}`,
          client_name: "like.[E2E%",
          limit: "1",
        });
        const existsResp = await fetch(`${url}/rest/v1/quotes?${q}`, { headers });
        if (existsResp.ok) {
          const rows = (await existsResp.json()) as unknown[];
          if (rows.length > 0) continue;
        }

        const insertResp = await fetch(`${url}/rest/v1/quotes`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            seller_id: sellerId,
            client_name: t.name,
            status: t.status,
            synced_to_bitrix: t.synced_to_bitrix,
            total: 100,
            notes: "e2e-seed-chips",
          }),
        });
        if (!insertResp.ok) {
          return {
            created,
            skipped: `insert-failed-${insertResp.status}-${t.label}`,
            names,
          };
        }
        created += 1;
        names.push(t.name);
      }

      return { created, skipped: null, names };
    },
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, targets },
  );
}
