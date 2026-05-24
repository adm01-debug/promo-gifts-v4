/**
 * supabase/functions/_shared/contracts/schemas/kit-ai-builder.ts
 *
 * v1: prompt 6-2000 chars. Sunset 2026-10-31.
 * v2: strict + idempotency_key.
 */
import { z } from "https://esm.sh/zod@3.23.8";

export const KitAiBuilderV1 = z.object({
  prompt: z
    .string()
    .min(6, { message: "prompt inválido (6–2000 chars)" })
    .max(2000, { message: "prompt inválido (6–2000 chars)" }),
});

export const KitAiBuilderV2 = z
  .object({
    prompt: z.string().min(6).max(2000),
    idempotency_key: z.string().uuid(),
  })
  .strict();

export const KitAiBuilderSchemas = {
  name: "kit-ai-builder",
  versions: { "1": KitAiBuilderV1, "2": KitAiBuilderV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-10-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#kit-ai-builder",
    },
  ],
};
