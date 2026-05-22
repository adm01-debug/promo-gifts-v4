/** Contrato do endpoint `external-db-inspect`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const ExternalDbInspectV1 = z.object({
  mode: z.enum(["tables", "columns"]).default("tables"),
  tableName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z_][a-z0-9_]*$/i, "Invalid table name")
    .optional(),
});

export type ExternalDbInspectV1Type = z.infer<typeof ExternalDbInspectV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: ExternalDbInspectV1,
    status: "stable",
    examples: {
      valid: [
        {},
        { mode: "tables" },
        { mode: "columns", tableName: "products" },
      ],
      invalid: [
        { payload: { mode: "drop" }, expectedPath: "mode" },
        {
          payload: { mode: "columns", tableName: "drop table" },
          expectedPath: "tableName",
        },
        {
          payload: { mode: "columns", tableName: "9bad" },
          expectedPath: "tableName",
        },
      ],
    },
  },
};
