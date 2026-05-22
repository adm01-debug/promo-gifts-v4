/** Contrato do endpoint `categories-api`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const CategoriesRequestV1 = z.object({
  action: z.enum(["tree", "all", "descendants", "products_by_categories"]),
  categoryIds: z.array(z.string().uuid()).max(200).optional(),
  includeDescendants: z.boolean().optional(),
});

export type CategoriesRequestV1Type = z.infer<typeof CategoriesRequestV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: CategoriesRequestV1,
    status: "stable",
    examples: {
      valid: [
        { action: "tree" },
        { action: "all" },
        {
          action: "descendants",
          categoryIds: ["00000000-0000-4000-8000-000000000000"],
        },
      ],
      invalid: [
        { payload: {}, expectedPath: "action" },
        { payload: { action: "foo" }, expectedPath: "action" },
        {
          payload: { action: "tree", categoryIds: ["not-uuid"] },
          expectedPath: "categoryIds.0",
        },
      ],
    },
  },
};
