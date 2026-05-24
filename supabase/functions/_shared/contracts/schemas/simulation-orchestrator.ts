/**
 * supabase/functions/_shared/contracts/schemas/simulation-orchestrator.ts
 *
 * v1: opcionais com defaults no handler. Sunset 2026-11-30.
 * v2: targetFunctions com 1+ items, mode obrigatório, idempotency_key.
 */
import { z } from "https://esm.sh/zod@3.23.8";

const ModeEnum = z.enum(["resilience", "load", "fuzzing"]);
const TargetFnEnum = z.enum([
  "external-db-bridge",
  "webhook-inbound",
  "product-webhook",
  "webhook-dispatcher",
]);

export const SimulationOrchestratorV1 = z.object({
  count: z.number().int().min(1).max(10000).optional(),
  targetFunctions: z.array(z.string().max(100)).max(20).optional(),
  mode: ModeEnum.optional(),
});

export const SimulationOrchestratorV2 = z
  .object({
    count: z.number().int().min(1).max(10000).default(100),
    targetFunctions: z.array(TargetFnEnum).min(1).max(20),
    mode: ModeEnum,
    idempotency_key: z.string().uuid(),
  })
  .strict();

export const SimulationOrchestratorSchemas = {
  name: "simulation-orchestrator",
  versions: {
    "1": SimulationOrchestratorV1,
    "2": SimulationOrchestratorV2,
  },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-11-30",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#simulation-orchestrator",
    },
  ],
};
