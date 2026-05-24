/**
 * supabase/functions/_shared/contracts/schemas/webhook-inbound.ts
 *
 * Contrato para o receptor genérico de webhooks externos (`webhook-inbound`).
 *
 * Hoje o endpoint aceita QUALQUER JSON (zero validação) e só verifica HMAC.
 * Isso permite inserir lixo em `inbound_webhook_events.payload`. Este contrato
 * passa a exigir um envelope mínimo, mantendo `data` livre para o emissor.
 *
 * v1 = aceita qualquer payload (forma adotada hoje em produção).
 * v2 = strict envelope: `event`, `occurred_at`, `data` exigidos.
 */

import { z } from "https://esm.sh/zod@3.23.8";

// ---------------------------------------------------------------------------
// v1 — passthrough (zero estrutura imposta) preservando compat
// ---------------------------------------------------------------------------

export const WebhookInboundV1 = z.any();

// ---------------------------------------------------------------------------
// v2 — envelope estruturado
// ---------------------------------------------------------------------------

export const WebhookInboundV2 = z
  .object({
    /** Tipo do evento (ex.: "order.created"). */
    event: z.string().min(1).max(150).regex(
      /^[a-z][a-z0-9_.-]*$/i,
      "event must be slug-like (letters, digits, '.', '_', '-')",
    ),
    /** Timestamp ISO em que o evento ocorreu no sistema de origem. */
    occurred_at: z.string().datetime(),
    /** Payload livre do emissor; objeto exigido para evitar bytes soltos. */
    data: z.record(z.unknown()),
    /** Idempotency-key opcional do emissor — quando presente, deve ser UUID. */
    idempotency_key: z.string().uuid().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Schemas exportados
// ---------------------------------------------------------------------------

export const WebhookInboundSchemas = {
  name: "webhook-inbound",
  versions: {
    "1": WebhookInboundV1,
    "2": WebhookInboundV2,
  },
  defaultVersion: "2" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-06-30",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#webhook-inbound-v1-v2",
    },
  ],
};

export type WebhookInboundV1Payload = z.infer<typeof WebhookInboundV1>;
export type WebhookInboundV2Payload = z.infer<typeof WebhookInboundV2>;
