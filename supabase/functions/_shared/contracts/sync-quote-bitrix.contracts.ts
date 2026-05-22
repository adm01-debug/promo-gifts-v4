/** Contrato do endpoint `sync-quote-bitrix`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const SyncQuoteBitrixV1 = z.object({
  quote: z.record(z.any()).optional(),
  proposalData: z.record(z.any()).optional(),
  pdfUrl: z.string().url().max(2000).optional(),
  filename: z.string().max(500).optional(),
  bitrixCompanyId: z.string().max(50).optional(),
  shippingType: z.string().max(50).optional(),
  shippingCost: z.number().nonnegative().optional(),
  sellerEmail: z.string().email().max(255).optional(),
});

export type SyncQuoteBitrixV1Type = z.infer<typeof SyncQuoteBitrixV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: SyncQuoteBitrixV1,
    status: "stable",
    examples: {
      valid: [
        { quote: { id: "1" }, pdfUrl: "https://example.com/q.pdf" },
        {},
      ],
      invalid: [
        { payload: { pdfUrl: "not-a-url" }, expectedPath: "pdfUrl" },
        { payload: { shippingCost: -1 }, expectedPath: "shippingCost" },
        { payload: { sellerEmail: "no-at" }, expectedPath: "sellerEmail" },
      ],
    },
  },
};
