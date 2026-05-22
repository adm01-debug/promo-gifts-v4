/**
 * supabase/functions/_shared/contracts/schemas/sync-external-db.ts
 *
 * v1: table obrigatório. Sunset 2026-11-30.
 * v2: strict + since como ISO 8601.
 */
import { z } from "https://esm.sh/zod@3.23.8";

const DirectionEnum = z.enum(["to-external", "from-external"]);

export const SyncExternalDbV1 = z.object({
  table: z.string().min(1).max(100),
  direction: DirectionEnum.optional(),
  since: z.string().max(50).optional(),
});

export const SyncExternalDbV2 = z
  .object({
    table: z.string().min(1).max(63),
    direction: DirectionEnum,
    since: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const SyncExternalDbSchemas = {
  name: "sync-external-db",
  versions: { "1": SyncExternalDbV1, "2": SyncExternalDbV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-11-30",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#sync-external-db",
    },
  ],
};
