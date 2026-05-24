/**
 * supabase/functions/_shared/contracts/schemas/ownership-repair.ts
 *
 * v1: todos opcionais. Sunset 2026-11-30.
 * v2: dry_run obrigatório + idempotency_key.
 */
import { z } from "https://esm.sh/zod@3.23.8";

export const OwnershipRepairV1 = z.object({
  report_id: z.string().max(100).optional(),
  dry_run: z.boolean().optional(),
  triggered_by: z.string().max(64).optional(),
});

export const OwnershipRepairV2 = z
  .object({
    report_id: z.string().uuid().optional(),
    dry_run: z.boolean(),
    triggered_by: z.string().min(1).max(64),
    idempotency_key: z.string().uuid(),
  })
  .strict();

export const OwnershipRepairSchemas = {
  name: "ownership-repair",
  versions: { "1": OwnershipRepairV1, "2": OwnershipRepairV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-11-30",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#ownership-repair",
    },
  ],
};
