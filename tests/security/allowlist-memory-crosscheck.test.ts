import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("allowlist ↔ security-memory cross-check", () => {
  it("todas as entradas das allowlists estão documentadas em docs/security/ALLOWLISTS_MEMORY.md", () => {
    let out = "";
    let code = 0;
    try {
      out = execSync("node scripts/check-allowlist-memory-crosscheck.mjs", {
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      code = err.status ?? 1;
      out = (err.stdout ?? "") + (err.stderr ?? "");
    }
    expect(code, out).toBe(0);
  });
});
