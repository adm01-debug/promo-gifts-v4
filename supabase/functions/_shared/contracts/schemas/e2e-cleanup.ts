/**
 * supabase/functions/_shared/contracts/schemas/e2e-cleanup.ts
 *
 * v1: shape permissivo do handler. Sunset 2026-12-31.
 * v2: strict + email obrigatório + confirm:true + idempotency_key.
 */
import { z } from "https://esm.sh/zod@3.23.8";

const SellerScopeEnum = z.enum(["self", "explicit"]);

export const E2eCleanupV1 = z.object({
  email: z.string().email().max(320).optional(),
  dryRun: z.boolean().optional(),
  sellerScope: SellerScopeEnum.optional(),
  sellerId: z.string().max(100).optional(),
  nameFilterPrefix: z.string().max(100).optional(),
});

export const E2eCleanupV2 = z
  .object({
    email: z.string().email().max(320),
    dryRun: z.boolean(),
    sellerScope: SellerScopeEnum.default("self"),
    sellerId: z.string().uuid().optional(),
    nameFilterPrefix: z.string().min(1).max(100).optional(),
    confirm: z.literal(true),
    idempotency_key: z.string().uuid(),
  })
  .strict()
  .refine(
    (v) => v.sellerScope !== "explicit" || !!v.sellerId,
    { message: "sellerId is required when sellerScope='explicit'", path: ["sellerId"] },
  );

export const E2eCleanupSchemas = {
  name: "e2e-cleanup",
  versions: { "1": E2eCleanupV1, "2": E2eCleanupV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-12-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#e2e-cleanup",
    },
  ],
};
