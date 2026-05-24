/**
 * supabase/functions/_shared/contracts/schemas/step-up-verify.ts
 *
 * v1: shape único permissivo (todos campos opcionais exceto step).
 *     Sunset 2026-10-31.
 * v2: discriminated union por step — auth sensível.
 */
import { z } from "https://esm.sh/zod@3.23.8";

const ActionEnum = z.enum([
  "promote_dev",
  "demote_dev",
  "mcp_full_issue",
  "mcp_full_escalate",
  "mcp_key_revoke",
  "mcp_key_rotate",
  "secret_rotation",
  "secret_revoke",
]);

export const StepUpVerifyV1 = z.object({
  step: z.enum(["request", "verify_password", "verify_otp", "cancel"]),
  action: ActionEnum.optional(),
  action_label: z.string().max(200).optional(),
  target_ref: z.string().max(500).nullable().optional(),
  challenge_id: z.string().max(100).optional(),
  password: z.string().max(1000).optional(),
  otp: z.string().max(20).optional(),
  cancel_reason: z.string().max(500).optional(),
});

const RequestStepV2 = z
  .object({
    step: z.literal("request"),
    action: ActionEnum,
    action_label: z.string().min(1).max(200).optional(),
    target_ref: z.string().max(500).nullable().optional(),
  })
  .strict();

const VerifyPasswordStepV2 = z
  .object({
    step: z.literal("verify_password"),
    challenge_id: z.string().uuid(),
    password: z.string().min(1).max(1000),
  })
  .strict();

const VerifyOtpStepV2 = z
  .object({
    step: z.literal("verify_otp"),
    challenge_id: z.string().uuid(),
    otp: z.string().min(4).max(20),
  })
  .strict();

const CancelStepV2 = z
  .object({
    step: z.literal("cancel"),
    challenge_id: z.string().uuid(),
    cancel_reason: z.string().max(500).optional(),
  })
  .strict();

export const StepUpVerifyV2 = z.discriminatedUnion("step", [
  RequestStepV2,
  VerifyPasswordStepV2,
  VerifyOtpStepV2,
  CancelStepV2,
]);

export const StepUpVerifySchemas = {
  name: "step-up-verify",
  versions: { "1": StepUpVerifyV1, "2": StepUpVerifyV2 },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-10-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#step-up-verify",
    },
  ],
};
