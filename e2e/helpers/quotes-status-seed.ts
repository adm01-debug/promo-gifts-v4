/**
 * Seed determinístico para /orcamentos — cobre TODOS os 14 status canônicos
 * do SSOT `QUOTE_ROW_BADGE_STYLES` (chips do topo + badges da linha).
 *
 * ⚠️  Limite documentado de BD: o CHECK atual de `quotes.status` aceita
 *     `draft, pending, sent, approved, rejected, expired, revision,
 *      pending_approval, converted, viewed`. NÃO aceita `cancelled` —
 *     esse badge fica como caminho defensivo de UI. O seed marca a chave
 *     `cancelled` como `skipped_reason='db-check-blocks'` para o spec
 *     tratar explicitamente (em vez de falhar silenciosamente).
 *
 * Reusa o JWT do admin no `localStorage`. Idempotente: se já houver um quote
 * E2E com o tuple alvo, pula a inserção. Nomes seguem `e2eName(...)` para o
 * `e2e-cleanup` apagar apenas estes registros.
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

/** Chaves canônicas do SSOT `QUOTE_ROW_BADGE_STYLES`. */
export const ALL_BADGE_KEYS = [
  "draft",
  "unsynced",
  "synced",
  "awaiting",
  "approved",
  "rejected",
  "expired",
  "expired_discount",
  "sent",
  "viewed",
  "quote_approved",
  "converted",
  "cancelled",
  "quote_rejected",
] as const;
export type BadgeKey = (typeof ALL_BADGE_KEYS)[number];

interface QuoteSeedTarget {
  badge_key: BadgeKey;
  label: string;
  status: string;
  synced_to_bitrix: boolean;
  discount_approval_status: string | null;
  /** Se preenchido, o seed NÃO tenta inserir e devolve esta razão. */
  unseedable_reason?: string;
}

/**
 * Mapeamento (badge → tuple BD) espelha a lógica de `getQuoteRowBadge`.
 * Mantenha sincronizado quando o SSOT mudar.
 */
const TARGETS: QuoteSeedTarget[] = [
  { badge_key: "draft", label: "draft", status: "draft", synced_to_bitrix: false, discount_approval_status: null },
  { badge_key: "unsynced", label: "unsynced", status: "pending", synced_to_bitrix: false, discount_approval_status: null },
  { badge_key: "synced", label: "synced", status: "pending", synced_to_bitrix: true, discount_approval_status: null },
  { badge_key: "awaiting", label: "awaiting", status: "pending_approval", synced_to_bitrix: true, discount_approval_status: "pending" },
  { badge_key: "approved", label: "dar-approved", status: "pending", synced_to_bitrix: true, discount_approval_status: "approved" },
  { badge_key: "rejected", label: "dar-rejected", status: "pending", synced_to_bitrix: true, discount_approval_status: "rejected" },
  { badge_key: "expired", label: "expired", status: "expired", synced_to_bitrix: false, discount_approval_status: null },
  { badge_key: "expired_discount", label: "dar-expired", status: "pending", synced_to_bitrix: true, discount_approval_status: "expired" },
  { badge_key: "sent", label: "sent", status: "sent", synced_to_bitrix: true, discount_approval_status: null },
  { badge_key: "viewed", label: "viewed", status: "viewed", synced_to_bitrix: true, discount_approval_status: null },
  { badge_key: "quote_approved", label: "quote-approved", status: "approved", synced_to_bitrix: true, discount_approval_status: null },
  { badge_key: "converted", label: "converted", status: "converted", synced_to_bitrix: true, discount_approval_status: null },
  {
    badge_key: "cancelled",
    label: "cancelled",
    status: "cancelled",
    synced_to_bitrix: false,
    discount_approval_status: null,
    unseedable_reason: "db-check-blocks-cancelled-for-quotes",
  },
  { badge_key: "quote_rejected", label: "quote-rejected", status: "rejected", synced_to_bitrix: true, discount_approval_status: null },
];

export interface QuotesStatusSeedTargetResult {
  badge_key: BadgeKey;
  seeded: boolean;
  reason: string | null;
  name: string | null;
}

export interface QuotesStatusSeedResult {
  /** Total de inserts realizados nesta corrida (não conta idempotentes). */
  created: number;
  /** Erro fatal (sem JWT, sem anon key) — encerra o seed antes de tudo. */
  skipped: string | null;
  /** Nomes de quotes recém-criados (para cleanup). */
  names: string[];
  /** Resultado por badge — usado pelo spec para iterar com diagnóstico. */
  perTarget: QuotesStatusSeedTargetResult[];
}

export async function seedQuotesForStatusChips(
  page: Page,
): Promise<QuotesStatusSeedResult> {
  const targets = TARGETS.map((t) => ({ ...t, name: e2eName(`chip-${t.label}`) }));

  return await page.evaluate(
    async ({ url, anonKey, targets }) => {
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
        return {
          created: 0,
          skipped: "no-jwt",
          names: [] as string[],
          perTarget: [] as QuotesStatusSeedTargetResult[],
        };
      }

      const headers: Record<string, string> = {
        apikey: anonKey,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      };

      let created = 0;
      const names: string[] = [];
      const perTarget: QuotesStatusSeedTargetResult[] = [];

      for (const t of targets) {
        if (t.unseedable_reason) {
          perTarget.push({
            badge_key: t.badge_key,
            seeded: false,
            reason: t.unseedable_reason,
            name: null,
          });
          continue;
        }

        // Idempotência: existe quote E2E equivalente?
        const q = new URLSearchParams({
          select: "id",
          status: `eq.${t.status}`,
          synced_to_bitrix: `eq.${t.synced_to_bitrix}`,
          client_name: "like.[E2E%",
          limit: "1",
        });
        if (t.discount_approval_status !== null) {
          q.set("discount_approval_status", `eq.${t.discount_approval_status}`);
        }
        const existsResp = await fetch(`${url}/rest/v1/quotes?${q}`, { headers });
        if (existsResp.ok) {
          const rows = (await existsResp.json()) as Array<{ id: string }>;
          if (rows.length > 0) {
            perTarget.push({
              badge_key: t.badge_key,
              seeded: true,
              reason: "already-existed",
              name: null,
            });
            continue;
          }
        }

        const body: Record<string, unknown> = {
          seller_id: sellerId,
          client_name: t.name,
          status: t.status,
          synced_to_bitrix: t.synced_to_bitrix,
          total: 100,
          notes: "e2e-seed-chips-v2",
        };
        if (t.discount_approval_status !== null) {
          body.discount_approval_status = t.discount_approval_status;
        }

        const insertResp = await fetch(`${url}/rest/v1/quotes`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!insertResp.ok) {
          const errBody = await insertResp.text().catch(() => "");
          perTarget.push({
            badge_key: t.badge_key,
            seeded: false,
            reason: `insert-failed-${insertResp.status}: ${errBody.slice(0, 120)}`,
            name: null,
          });
          continue;
        }
        created += 1;
        names.push(t.name);
        perTarget.push({
          badge_key: t.badge_key,
          seeded: true,
          reason: "created",
          name: t.name,
        });
      }

      return { created, skipped: null, names, perTarget };
    },
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, targets },
  );
}
