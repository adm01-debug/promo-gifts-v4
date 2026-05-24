/**
 * supabase/functions/_shared/contracts/schemas/ownership-audit.ts
 *
 * v1: body opcional; default "cron" no handler. Sunset 2026-11-30.
 * v2: triggered_by obrigatório.
 */
import { z } from "https://esm.sh/zod@3.23.8";

export const OwnershipAuditV1 = z.object({
  triggered_by: z.string().max(64).optional(),
});

export const OwnershipAuditV2 = z
  .object({
    triggered_by: z.string().min(1).max(64),
  })
  .strict();

export const OwnershipAuditSchemas = {
  name: "ownership-audit",
  versions: { "1": OwnershipAuditV1, "2": OwnershipAuditV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-11-30",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#ownership-audit",
    },
  ],
};
