/** Contrato do endpoint `rate-limit-check`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const RateLimitCheckV1 = z.object({
  endpoint: z.enum(["login", "api", "ai", "approval"]).default("api"),
});

export type RateLimitCheckV1Type = z.infer<typeof RateLimitCheckV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: RateLimitCheckV1,
    status: "stable",
    examples: {
      valid: [{}, { endpoint: "login" }, { endpoint: "ai" }],
      invalid: [
        { payload: { endpoint: "foo" }, expectedPath: "endpoint" },
        { payload: { endpoint: 1 }, expectedPath: "endpoint" },
      ],
    },
  },
};
