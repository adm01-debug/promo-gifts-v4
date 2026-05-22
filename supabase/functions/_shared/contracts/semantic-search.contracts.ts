/** Contrato do endpoint `semantic-search`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

const ProductForRank = z.object({
  id: z.string().min(1),
  name: z.string().optional().default(""),
  description: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional().default(""),
});

export const SemanticSearchV1 = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Query too short")
    .max(500, "Query too long"),
  products: z.array(ProductForRank).max(500).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type SemanticSearchV1Type = z.infer<typeof SemanticSearchV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: SemanticSearchV1,
    status: "stable",
    examples: {
      valid: [
        { query: "caneta personalizada" },
        { query: "garrafa", limit: 50, products: [{ id: "p1" }] },
      ],
      invalid: [
        { payload: {}, expectedPath: "query" },
        { payload: { query: "" }, expectedPath: "query" },
        { payload: { query: "a" }, expectedPath: "query" },
        { payload: { query: "ok", limit: 999 }, expectedPath: "limit" },
      ],
    },
  },
};
