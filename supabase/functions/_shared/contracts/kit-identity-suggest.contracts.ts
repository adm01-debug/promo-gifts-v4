/** Contrato do endpoint `kit-identity-suggest`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const KitIdentitySuggestV1 = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        name: z.string().max(200).optional(),
        sku: z.string().max(100).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export type KitIdentitySuggestV1Type = z.infer<typeof KitIdentitySuggestV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: KitIdentitySuggestV1,
    status: "stable",
    examples: {
      valid: [
        { name: "Kit Boas-Vindas" },
        { items: [{ name: "Caneta" }, { sku: "BRD-1" }] },
        {},
      ],
      invalid: [
        { payload: { name: 123 }, expectedPath: "name" },
        { payload: { items: "not-array" }, expectedPath: "items" },
        {
          payload: { items: [{ sku: 999 }] },
          expectedPath: "items.0.sku",
        },
      ],
    },
  },
};
