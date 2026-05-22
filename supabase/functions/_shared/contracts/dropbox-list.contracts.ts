/** Contrato do endpoint `dropbox-list`. */
import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

export const DropboxListV1 = z.object({
  path: z.string().max(1000).default(""),
  action: z.enum(["list", "check"]).default("list"),
});

export type DropboxListV1Type = z.infer<typeof DropboxListV1>;

export const contracts: ContractRegistry<"v1"> = {
  v1: {
    schema: DropboxListV1,
    status: "stable",
    examples: {
      valid: [{}, { path: "/folder", action: "list" }, { action: "check" }],
      invalid: [
        { payload: { action: "foo" }, expectedPath: "action" },
        { payload: { path: 123 }, expectedPath: "path" },
      ],
    },
  },
};
