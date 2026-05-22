/** Contrato do endpoint `magic-up-score`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const MagicUpScoreV1 = z.object({
  imageUrl: z.string().min(10),
  productName: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  campaignBrief: z.record(z.unknown()).optional().nullable(),
  brandKit: z.record(z.unknown()).optional().nullable(),
  creativeControls: z.record(z.unknown()).optional().nullable(),
  promptText: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
  aspectRatio: z.string().optional().nullable(),
});

export type MagicUpScoreV1Type = z.infer<typeof MagicUpScoreV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: MagicUpScoreV1,
    status: "stable",
    examples: {
      valid: [
        { imageUrl: "https://cdn.example.com/img.png" },
        { imageUrl: "x".repeat(50), productName: "Caneca" },
      ],
      invalid: [
        { payload: {}, expectedPath: "imageUrl" },
        { payload: { imageUrl: "" }, expectedPath: "imageUrl" },
        { payload: { imageUrl: "abc" }, expectedPath: "imageUrl" },
      ],
    },
  },
};
