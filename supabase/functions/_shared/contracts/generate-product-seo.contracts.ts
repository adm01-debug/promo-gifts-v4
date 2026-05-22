/** Contrato do endpoint `generate-product-seo`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const ProductSeoV1 = z.object({
  product: z.object({
    name: z
      .string()
      .trim()
      .min(1, "Nome do produto é obrigatório")
      .max(255),
    sku: z.string().max(100).optional(),
    description: z.string().max(5000).optional(),
    short_description: z.string().max(1000).optional(),
    brand: z.string().max(200).optional(),
    category_name: z.string().max(200).optional(),
    country_of_origin: z.string().max(100).optional(),
    materials: z.string().max(500).optional(),
    sale_price: z.union([z.string(), z.number()]).optional(),
  }),
});

export type ProductSeoV1Type = z.infer<typeof ProductSeoV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: ProductSeoV1,
    status: "stable",
    examples: {
      valid: [{ product: { name: "Caneta Personalizada" } }],
      invalid: [
        { payload: {}, expectedPath: "product" },
        { payload: { product: {} }, expectedPath: "product.name" },
        { payload: { product: { name: "" } }, expectedPath: "product.name" },
      ],
    },
  },
};
