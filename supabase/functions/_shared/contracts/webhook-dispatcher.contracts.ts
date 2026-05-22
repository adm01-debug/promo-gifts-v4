/**
 * Contrato do endpoint `webhook-dispatcher`.
 * Disparado por triggers DB / RPCs / cron para entregar eventos a outbound_webhooks.
 */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const DispatchEventV1 = z.object({
  event: z.string().min(1),
  payload: z.unknown().optional(),
  replay_delivery_id: z.string().uuid().optional(),
  test_mode: z.boolean().optional(),
  test_webhook_id: z.string().uuid().optional(),
});

export type DispatchEventV1Type = z.infer<typeof DispatchEventV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: DispatchEventV1,
    status: "stable",
    examples: {
      valid: [
        { event: "order.created", payload: { id: "ord_1", total: 100 } },
        { event: "quote.updated" },
        {
          event: "test",
          test_mode: true,
          test_webhook_id: "00000000-0000-4000-8000-000000000000",
        },
        {
          event: "replay",
          replay_delivery_id: "00000000-0000-4000-8000-000000000001",
        },
      ],
      invalid: [
        { payload: { event: "" }, expectedPath: "event" },
        { payload: {}, expectedPath: "event" },
        {
          payload: { event: "x", test_webhook_id: "not-a-uuid" },
          expectedPath: "test_webhook_id",
        },
      ],
    },
  },
};
