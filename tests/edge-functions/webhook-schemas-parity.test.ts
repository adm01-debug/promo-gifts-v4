/**
 * Parity contract: src/lib/webhook-schemas.ts (Node) MUST mirror
 * supabase/functions/_shared/webhook-schemas.ts (Deno).
 *
 * The Deno copy is canonical (Edge Functions run against it).  This test
 * statically diffs both files so a refactor on one side blocks CI until
 * the mirror is updated.
 *
 * The acceptable difference is the Zod import line:
 *   Deno:  import { z } from "https://esm.sh/zod@3.23.8";
 *   Node:  import { z } from "zod";
 *
 * Both validation-errors files are also checked for symmetry of exports.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function normalize(src: string): string {
  return src
    // Strip license/doc preamble comments above the first import.
    .replace(/^[\s\S]*?(?=^import )/m, "")
    // Normalize Zod import paths.
    .replace(/import \{ z \} from "https:\/\/esm\.sh\/zod@3\.23\.8";/g, 'import { z } from "zod";')
    // Normalize Deno-only type-only imports referenced in validation-errors.ts.
    .replace(
      /import type \{ ZodError, ZodIssue \} from "https:\/\/esm\.sh\/zod@3\.23\.8";/g,
      'import type { ZodError, ZodIssue } from "zod";',
    )
    .replace(/\r\n/g, "\n");
}

function extractExports(src: string): string[] {
  const out = new Set<string>();
  const reExport = /export\s+(?:const|function|class|type|interface|enum|let|var)\s+([A-Za-z_$][\w$]*)/g;
  const reReExport = /export\s+\{\s*([^}]+)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = reExport.exec(src))) out.add(m[1]);
  while ((m = reReExport.exec(src))) {
    for (const name of m[1].split(",")) {
      const clean = name.trim().split(/\s+as\s+/)[0].trim();
      if (clean) out.add(clean);
    }
  }
  return Array.from(out).sort();
}

describe("schema parity: webhook-schemas.ts (Deno) ↔ src/lib/webhook-schemas.ts (Node)", () => {
  const denoPath = resolve(__dirname, "../../supabase/functions/_shared/webhook-schemas.ts");
  const nodePath = resolve(__dirname, "../../src/lib/webhook-schemas.ts");
  const deno = readFileSync(denoPath, "utf8");
  const node = readFileSync(nodePath, "utf8");

  it("both files export the same symbol set", () => {
    const denoExports = extractExports(deno);
    const nodeExports = extractExports(node);
    expect(nodeExports).toEqual(denoExports);
  });

  it("schema body (after normalizing import paths) is byte-identical", () => {
    expect(normalize(node)).toEqual(normalize(deno));
  });
});

describe("schema parity: validation-errors.ts (Deno) ↔ src/lib/validation-errors.ts (Node)", () => {
  const denoPath = resolve(__dirname, "../../supabase/functions/_shared/validation-errors.ts");
  const nodePath = resolve(__dirname, "../../src/lib/validation-errors.ts");
  const deno = readFileSync(denoPath, "utf8");
  const node = readFileSync(nodePath, "utf8");

  it("both files export the same canonical names", () => {
    const denoExports = extractExports(deno);
    const nodeExports = extractExports(node);
    // The Node mirror is allowed to omit Deno-only helpers (Response builders
    // that depend on Deno's Response constructor) but MUST include all the
    // pure functions and constants.
    const required = [
      "VALIDATION_ERROR_STATUS",
      "VALIDATION_ERROR_CODE",
      "ContractVersion",
      "FieldError",
      "ValidationErrorV1",
      "ValidationErrorV2",
      "ValidationErrorPayload",
      "detectContractVersion",
      "zodIssuesToFieldErrors",
      "buildValidationErrorV1",
      "buildValidationErrorV2",
      "buildValidationError",
    ];
    for (const name of required) {
      expect(denoExports).toContain(name);
      expect(nodeExports).toContain(name);
    }
  });
});
