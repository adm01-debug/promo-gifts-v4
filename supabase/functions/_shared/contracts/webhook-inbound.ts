/**
 * Contratos do webhook-inbound (v1).
 *
 * Antes desta migração o webhook-inbound aceitava qualquer JSON após HMAC OK,
 * o que permitia que upstream malformados inundassem a tabela
 * `inbound_webhook_events` com lixo. Esta é a primeira versão formal do
 * contrato — todo payload precisa ter pelo menos um campo `event` ou `type`
 * e um `data` (estrutural mínimo).
 *
 * Como upstreams (n8n, Bitrix, Lovable, GitHub) variam muito, o schema é
 * propositadamente FROUXO em `data` (z.unknown), mas EXIGENTE no envelope.
 */

import { z } from "https://esm.sh/zod@3.23.8";

// ---------------------------------------------------------------------------
// v1 — primeiro contrato formal
// ---------------------------------------------------------------------------

export const WebhookInboundV1Schema = z
  .object({
    // Pelo menos um identificador de evento é obrigatório.
    event: z.string().min(1).max(120).optional(),
    type: z.string().min(1).max(120).optional(),
    // ID do evento na origem (idempotência futura).
    source_event_id: z.string().min(1).max(255).optional(),
    // Timestamp ISO 8601 ou epoch ms.
    occurred_at: z.union([z.string().datetime(), z.number().int().positive()]).optional(),
    // Payload livre — schema-on-read. Tipo aceito é qualquer um, mas chave é OBRIGATÓRIA.
    data: z.unknown(),
    // Metadata adicional (origem, versão do upstream, etc).
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => Boolean(d.event) || Boolean(d.type), {
    message: "É obrigatório informar 'event' ou 'type'",
    path: ["event"],
  })
  // z.unknown() em objeto torna a chave opcional por padrão — refinamos
  // para exigir presença literal de "data" (mesmo que valor seja null/array/etc).
  .refine((d) => "data" in d, {
    message: "É obrigatório informar 'data'",
    path: ["data"],
  });

export type WebhookInboundV1 = z.infer<typeof WebhookInboundV1Schema>;

// ---------------------------------------------------------------------------
// Manifesto
// ---------------------------------------------------------------------------

export const WebhookInboundVersions = ["v1"] as const;
export type WebhookInboundVersion = typeof WebhookInboundVersions[number];

export const WebhookInboundSchemaByVersion = {
  v1: WebhookInboundV1Schema,
} as const;
