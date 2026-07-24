/**
 * supabase/functions/_shared/contracts/schemas/market-intelligence-insights.ts
 *
 * v1: todos campos opcionais (compat com body vazio). Sunset 2026-10-31.
 * v2: strict, UUIDs validados.
 */
import { z } from "https://esm.sh/zod@3.23.8";

export const InsightFocusEnum = z.enum(["auto", "conversion", "ticket", "rupture"]);
export type InsightFocus = z.infer<typeof InsightFocusEnum>;

export const MarketIntelligenceInsightsV1 = z.object({
  days: z.number().int().min(1).max(365).optional(),
  categoryId: z.string().max(100).nullable().optional(),
  supplierId: z.string().max(100).nullable().optional(),
  productId: z.string().max(100).nullable().optional(),
  categoryName: z.string().max(255).nullable().optional(),
  supplierName: z.string().max(255).nullable().optional(),
  productName: z.string().max(255).nullable().optional(),
  forceRefresh: z.boolean().optional(),
  focus: InsightFocusEnum.optional(),
});

export const MarketIntelligenceInsightsV2 = z
  .object({
    days: z.number().int().min(1).max(365).default(30),
    categoryId: z.string().uuid().nullable().optional(),
    supplierId: z.string().uuid().nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
    categoryName: z.string().min(1).max(255).nullable().optional(),
    supplierName: z.string().min(1).max(255).nullable().optional(),
    productName: z.string().min(1).max(255).nullable().optional(),
    forceRefresh: z.boolean().default(false),
    focus: InsightFocusEnum.default("auto"),
  })
  .strict();

export const MarketIntelligenceInsightsSchemas = {
  name: "market-intelligence-insights",
  versions: {
    "1": MarketIntelligenceInsightsV1,
    "2": MarketIntelligenceInsightsV2,
  },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-10-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#market-intelligence-insights",
    },
  ],
};
