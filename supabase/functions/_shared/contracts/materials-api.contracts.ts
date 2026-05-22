/** Contrato do endpoint `materials-api`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const MaterialsRequestV1 = z.object({
  action: z.enum([
    "groups",
    "types",
    "types_by_group",
    "product_materials",
    "products_by_materials",
    "stats",
    "search",
    "complete",
  ]),
  groupId: z.string().max(255).optional(),
  materialId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  materialTypeIds: z.array(z.string().uuid()).max(200).optional(),
  materialGroupSlugs: z.array(z.string().max(100)).max(50).optional(),
  limit: z.number().int().min(1).max(500).default(100),
  search: z.string().max(200).optional(),
});

export type MaterialsRequestV1Type = z.infer<typeof MaterialsRequestV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: MaterialsRequestV1,
    status: "stable",
    examples: {
      valid: [
        { action: "groups" },
        { action: "types_by_group", groupId: "plasticos" },
        {
          action: "products_by_materials",
          materialTypeIds: ["00000000-0000-4000-8000-000000000000"],
        },
      ],
      invalid: [
        { payload: {}, expectedPath: "action" },
        { payload: { action: "foo" }, expectedPath: "action" },
        {
          payload: { action: "groups", limit: 9999 },
          expectedPath: "limit",
        },
      ],
    },
  },
};
