/**
 * supabase/functions/_shared/contracts/schemas/force-global-logout.ts
 *
 * v1: confirm literal. Sunset 2026-12-31.
 * v2: confirm + idempotency_key (destrutivo).
 */
import { z } from "https://esm.sh/zod@3.23.8";

export const ForceGlobalLogoutV1 = z.object({
  confirm: z.literal("FORCE_LOGOUT_ALL"),
});

export const ForceGlobalLogoutV2 = z
  .object({
    confirm: z.literal("FORCE_LOGOUT_ALL"),
    idempotency_key: z.string().uuid(),
  })
  .strict();

export const ForceGlobalLogoutSchemas = {
  name: "force-global-logout",
  versions: { "1": ForceGlobalLogoutV1, "2": ForceGlobalLogoutV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-12-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#force-global-logout",
    },
  ],
};
