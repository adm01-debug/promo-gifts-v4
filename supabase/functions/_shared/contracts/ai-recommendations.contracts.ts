/** Contrato do endpoint `ai-recommendations`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

const ClientSchema = z.object({
  name: z.string().trim().min(1).max(255),
  company: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  preferences: z.array(z.string().max(100)).max(20).optional(),
  purchaseHistory: z.array(z.string().max(200)).max(50).optional(),
  budget: z.string().max(100).optional(),
});

const ProductSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  priceRange: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const RecommendationRequestV1 = z.object({
  client: ClientSchema,
  products: z.array(ProductSchema).min(1).max(100),
});

export type RecommendationRequestV1Type = z.infer<
  typeof RecommendationRequestV1
>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: RecommendationRequestV1,
    status: "stable",
    examples: {
      valid: [
        {
          client: { name: "Empresa X", industry: "Tech" },
          products: [
            { id: "p1", name: "Caneca", category: "Mug" },
            { id: "p2", name: "Mochila", category: "Bag" },
          ],
        },
      ],
      invalid: [
        {
          payload: { client: { name: "Y" }, products: [] },
          expectedPath: "products",
        },
        { payload: { products: [{ id: "p", name: "n", category: "c" }] }, expectedPath: "client" },
        { payload: { client: { name: "" }, products: [{ id: "p", name: "n", category: "c" }] }, expectedPath: "client.name" },
      ],
    },
  },
};
