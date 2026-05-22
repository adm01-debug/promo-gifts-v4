/** Contrato do endpoint `generate-ad-prompt`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const AdPromptV1 = z.object({
  productName: z.string().trim().min(1, "Product name is required").max(255),
  productColor: z.string().max(100).optional(),
  productCategory: z.string().max(100).optional(),
  techniqueName: z.string().max(100).optional(),
  locationName: z.string().max(100).optional(),
  maxWidth: z.union([z.string(), z.number()]).optional(),
  maxHeight: z.union([z.string(), z.number()]).optional(),
  dimensionUnit: z.string().max(10).optional(),
  isCurved: z.boolean().optional(),
  clientSegment: z.string().max(200).optional(),
  clientName: z.string().max(200).optional(),
  brandColorName: z.string().max(100).optional(),
  objective: z.string().max(500).optional(),
  tone: z.string().max(100).optional(),
  targetAudience: z.string().max(200).optional(),
  season: z.string().max(100).optional(),
  numberOfPrompts: z.number().int().min(1).max(6).optional(),
});

export type AdPromptV1Type = z.infer<typeof AdPromptV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: AdPromptV1,
    status: "stable",
    examples: {
      valid: [
        { productName: "Caneta Metal" },
        { productName: "Caderno", isCurved: true, tone: "luxo" },
      ],
      invalid: [
        { payload: {}, expectedPath: "productName" },
        { payload: { productName: "" }, expectedPath: "productName" },
        {
          payload: { productName: "x", isCurved: "yes" },
          expectedPath: "isCurved",
        },
      ],
    },
  },
};
