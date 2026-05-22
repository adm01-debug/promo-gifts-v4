/** Contrato do endpoint `analyze-logo-colors`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const AnalyzeLogoV1 = z.object({
  imageBase64: z
    .string()
    .min(10, "imageBase64 is required")
    .max(10_000_000, "Image too large"),
});

export type AnalyzeLogoV1Type = z.infer<typeof AnalyzeLogoV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: AnalyzeLogoV1,
    status: "stable",
    examples: {
      valid: [{ imageBase64: "x".repeat(100) }],
      invalid: [
        { payload: {}, expectedPath: "imageBase64" },
        { payload: { imageBase64: "" }, expectedPath: "imageBase64" },
      ],
    },
  },
};
