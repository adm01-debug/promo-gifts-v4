/**
 * supabase/functions/_shared/contracts/schemas/trends-insights.ts
 *
 * v1: days opcional (1-365). Sunset 2026-11-30.
 * v2: strict.
 */
import { z } from "https://esm.sh/zod@3.23.8";

export const TrendsInsightsV1 = z.object({
  days: z.number().int().min(1).max(365).optional(),
});

export const TrendsInsightsV2 = z
  .object({
    days: z.number().int().min(1).max(365),
  })
  .strict();

export const TrendsInsightsSchemas = {
  name: "trends-insights",
  versions: { "1": TrendsInsightsV1, "2": TrendsInsightsV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-11-30",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#trends-insights",
    },
  ],
};
