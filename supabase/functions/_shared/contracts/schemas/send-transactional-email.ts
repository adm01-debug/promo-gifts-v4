/**
 * supabase/functions/_shared/contracts/schemas/send-transactional-email.ts
 *
 * v1: shape EmailRequest atual (compat). Sunset 2026-10-31.
 * v2: strict + idempotency_key.
 */
import { z } from "https://esm.sh/zod@3.23.8";

const EmailEvent = z.enum([
  "quote_sent",
  "quote_approved",
  "quote_rejected",
  "order_created",
]);

export const SendTransactionalEmailV1 = z.object({
  event_type: EmailEvent,
  recipient_email: z.string().email().max(320),
  recipient_name: z.string().max(200).optional(),
  data: z.record(z.unknown()).default({}),
});

export const SendTransactionalEmailV2 = z
  .object({
    event_type: EmailEvent,
    recipient_email: z.string().email().max(320),
    recipient_name: z.string().min(1).max(200).optional(),
    data: z.record(z.unknown()),
    idempotency_key: z.string().uuid(),
  })
  .strict();

export const SendTransactionalEmailSchemas = {
  name: "send-transactional-email",
  versions: { "1": SendTransactionalEmailV1, "2": SendTransactionalEmailV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-10-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#send-transactional-email",
    },
  ],
};
