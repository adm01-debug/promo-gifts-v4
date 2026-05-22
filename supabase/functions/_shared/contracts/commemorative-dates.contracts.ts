/** Contrato do endpoint `commemorative-dates`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const CommemorativeDatesV1 = z.object({
  action: z.enum([
    "get_active_dates",
    "get_upcoming_dates",
    "get_products_by_date",
    "get_dates_with_colors",
  ]),
  params: z
    .object({
      days_ahead: z.number().int().min(1).max(365).optional(),
      slug: z.string().trim().min(1).max(200).optional(),
      limit: z.number().int().min(1).max(500).optional(),
      include_all_colors: z.boolean().optional(),
    })
    .optional(),
});

export type CommemorativeDatesV1Type = z.infer<typeof CommemorativeDatesV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: CommemorativeDatesV1,
    status: "stable",
    examples: {
      valid: [
        { action: "get_active_dates" },
        { action: "get_upcoming_dates", params: { days_ahead: 30 } },
        { action: "get_products_by_date", params: { slug: "natal", limit: 20 } },
      ],
      invalid: [
        { payload: {}, expectedPath: "action" },
        { payload: { action: "x" }, expectedPath: "action" },
        {
          payload: { action: "get_active_dates", params: { days_ahead: 500 } },
          expectedPath: "params.days_ahead",
        },
      ],
    },
  },
};
