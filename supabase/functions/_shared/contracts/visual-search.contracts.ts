/** Contrato do endpoint `visual-search`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const VisualSearchV1 = z.object({
  imageBase64: z
    .string()
    .min(10, "Image is required")
    .max(10_000_000, "Image too large"),
});

export type VisualSearchV1Type = z.infer<typeof VisualSearchV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: VisualSearchV1,
    status: "stable",
    examples: {
      valid: [{ imageBase64: "x".repeat(100) }],
      invalid: [
        { payload: {}, expectedPath: "imageBase64" },
        { payload: { imageBase64: "" }, expectedPath: "imageBase64" },
        { payload: { imageBase64: "abc" }, expectedPath: "imageBase64" },
      ],
    },
  },
};
