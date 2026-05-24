/**
 * supabase/functions/_shared/contracts/schemas/bi-copilot.ts
 *
 * v1: question 1-500 chars + context/history opcionais (usados no handler).
 *     Sunset 2026-10-31.
 * v2: strict + context obrigatório.
 */
import { z } from "https://esm.sh/zod@3.23.8";

const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(10000),
});

export const BiCopilotV1 = z.object({
  question: z.string().min(1).max(500),
  context: z.record(z.unknown()).optional(),
  history: z.array(ChatMessage).max(50).optional(),
});

export const BiCopilotV2 = z
  .object({
    question: z.string().min(3).max(500),
    context: z.record(z.unknown()),
    history: z.array(ChatMessage).max(50).optional(),
  })
  .strict();

export const BiCopilotSchemas = {
  name: "bi-copilot",
  versions: { "1": BiCopilotV1, "2": BiCopilotV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-10-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#bi-copilot",
    },
  ],
};
