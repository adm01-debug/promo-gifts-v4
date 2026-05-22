/**
 * Contrato do endpoint `webhook-inbound`.
 *
 * Particularidade: este endpoint aceita payloads *opacos* de terceiros — o
 * body é encaminhado para `inbound_webhook_events.payload` como JSON livre.
 * O contrato cobre o envelope mínimo + headers obrigatórios, não a forma do
 * payload em si.
 *
 * Os campos críticos vêm via header/query, não no body:
 *   - `?slug=<endpoint-slug>`          (obrigatório)
 *   - `X-Signature-256: sha256=<hmac>` (obrigatório quando endpoint tem secret)
 *   - `X-Event: <event-name>`          (opcional, default 'unknown')
 *
 * O schema do *body* é intencionalmente permissivo (`z.unknown()`): o handler
 * apenas registra o evento e valida HMAC. A validação semântica fica a cargo
 * dos processadores downstream.
 */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

/** Schema do envelope HTTP (query + headers + body cru). */
export const InboundEnvelopeV1 = z.object({
  slug: z.string().min(1).max(200),
  signature: z.string().min(10).max(200).optional(),
  event: z.string().max(100).optional(),
  /** Body — opaco. Mantemos `unknown` para não rejeitar payloads válidos do parceiro. */
  body: z.unknown(),
});

export type InboundEnvelopeV1Type = z.infer<typeof InboundEnvelopeV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: InboundEnvelopeV1,
    status: "stable",
    examples: {
      valid: [
        {
          slug: "asaas-payment",
          signature: "sha256=" + "a".repeat(64),
          event: "PAYMENT_RECEIVED",
          body: { event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } },
        },
        { slug: "hotmart", body: {} },
      ],
      invalid: [
        { payload: { body: {} }, expectedPath: "slug" },
        { payload: { slug: "", body: {} }, expectedPath: "slug" },
        {
          payload: { slug: "x", signature: "ab", body: {} },
          expectedPath: "signature",
        },
      ],
    },
  },
};
