/** Contrato do endpoint `quote-sync` (discriminated union por `action`). */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

const SyncQuote = z.object({
  action: z.literal("sync_quote"),
  data: z.object({
    quoteId: z.string().uuid("quoteId must be a valid UUID"),
  }),
});

const SyncAllPending = z.object({
  action: z.literal("sync_all_pending"),
  data: z.object({}).optional(),
});

const TestWebhook = z.object({
  action: z.literal("test_webhook"),
  data: z.object({}).optional(),
});

export const QuoteSyncRequestV1 = z.discriminatedUnion("action", [
  SyncQuote,
  SyncAllPending,
  TestWebhook,
]);

export type QuoteSyncRequestV1Type = z.infer<typeof QuoteSyncRequestV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: QuoteSyncRequestV1,
    status: "stable",
    examples: {
      valid: [
        {
          action: "sync_quote",
          data: { quoteId: "00000000-0000-4000-8000-000000000000" },
        },
        { action: "sync_all_pending" },
        { action: "test_webhook" },
      ],
      invalid: [
        { payload: {}, expectedPath: "action" },
        { payload: { action: "unknown" }, expectedPath: "action" },
        {
          payload: { action: "sync_quote", data: { quoteId: "not-uuid" } },
          expectedPath: "data.quoteId",
        },
      ],
    },
  },
};
