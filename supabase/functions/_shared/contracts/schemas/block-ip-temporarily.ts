/**
 * supabase/functions/_shared/contracts/schemas/block-ip-temporarily.ts
 *
 * v1: regex permissivo (mesmo do handler atual). Sunset 2026-12-31.
 * v2: regex IPv4/IPv6/CIDR rigoroso + strict.
 */
import { z } from "https://esm.sh/zod@3.23.8";

// V1 = mesmo regex permissivo do handler atual em produção (compat exato)
const IP_REGEX_V1 = /^[0-9a-fA-F:.\/]{3,45}$/;
// V2 = validação rigorosa IPv4/IPv6/CIDR
const IP_REGEX_V2 =
  /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$|^([0-9a-fA-F:]+)(\/([0-9]|[1-9][0-9]|1[01][0-9]|12[0-8]))?$/;

export const BlockIpTemporarilyV1 = z.object({
  ip: z.string().min(1).max(45).regex(IP_REGEX_V1, {
    message: "IP inválido (use IPv4, IPv6 ou CIDR)",
  }),
  reason: z.string().max(500).optional(),
  hours: z.number().int().min(1).max(720).optional(),
});

export const BlockIpTemporarilyV2 = z
  .object({
    ip: z.string().min(1).max(45).regex(IP_REGEX_V2, {
      message: "IP inválido (use IPv4, IPv6 ou CIDR)",
    }),
    reason: z.string().min(1).max(500),
    hours: z.number().int().min(1).max(720),
  })
  .strict();

export const BlockIpTemporarilySchemas = {
  name: "block-ip-temporarily",
  versions: { "1": BlockIpTemporarilyV1, "2": BlockIpTemporarilyV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-12-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#block-ip-temporarily",
    },
  ],
};
