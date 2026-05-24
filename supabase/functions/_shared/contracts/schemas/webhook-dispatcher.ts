/**
 * supabase/functions/_shared/contracts/schemas/webhook-dispatcher.ts
 *
 * Contrato do disparador outbound (`webhook-dispatcher`).
 *
 * v1: schema atual (preserva compat com triggers DB + RPCs).
 * v2: strict; força distinção entre `dispatch | replay | test`, e exige
 *     campos coerentes para cada modo via discriminated union.
 */

import { z } from "https://esm.sh/zod@3.23.8";

// ---------------------------------------------------------------------------
// v1 — compat com produção
// ---------------------------------------------------------------------------

export const WebhookDispatcherV1 = z.object({
  event: z.string().min(1),
  payload: z.unknown().optional(),
  replay_delivery_id: z.string().uuid().optional(),
  test_mode: z.boolean().optional(),
  test_webhook_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// v2 — discriminated union por `mode`
// ---------------------------------------------------------------------------

const Dispatch = z.object({
  mode: z.literal("dispatch"),
  event: z.string().min(1).max(150),
  payload: z.record(z.unknown()),
}).strict();

const Replay = z.object({
  mode: z.literal("replay"),
  replay_delivery_id: z.string().uuid(),
}).strict();

const TestRun = z.object({
  mode: z.literal("test"),
  event: z.string().min(1).max(150),
  payload: z.record(z.unknown()),
  test_webhook_id: z.string().uuid(),
}).strict();

export const WebhookDispatcherV2 = z.discriminatedUnion("mode", [
  Dispatch,
  Replay,
  TestRun,
]);

// ---------------------------------------------------------------------------
// Schemas exportados
// ---------------------------------------------------------------------------

export const WebhookDispatcherSchemas = {
  name: "webhook-dispatcher",
  versions: {
    "1": WebhookDispatcherV1,
    "2": WebhookDispatcherV2,
  },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-09-30",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#webhook-dispatcher-v1-v2",
    },
  ],
};

export type WebhookDispatcherV1Payload = z.infer<typeof WebhookDispatcherV1>;
export type WebhookDispatcherV2Payload = z.infer<typeof WebhookDispatcherV2>;
