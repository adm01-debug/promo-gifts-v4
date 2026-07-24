import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Testa scripts/check-iframe-sandbox.mjs isoladamente montando um
 * projeto-fantoche em /tmp com src/ contendo fixtures seguras e
 * inseguras. O script real é copiado, para exercer o mesmo binário
 * usado no CI.
 */

const REPO_ROOT = process.cwd();
const SCRIPT = join(REPO_ROOT, "scripts", "check-iframe-sandbox.mjs");

function makeSandbox(files: Record<string, string>, allowlist?: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "iframe-gate-"));
  const scriptsDir = join(dir, "scripts");
  const srcDir = join(dir, "src");
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(srcDir, { recursive: true });
  cpSync(SCRIPT, join(scriptsDir, "check-iframe-sandbox.mjs"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
  if (allowlist) {
    writeFileSync(join(dir, ".iframe-sandbox-allowlist.json"), JSON.stringify(allowlist));
  }
  return dir;
}

function run(cwd: string) {
  try {
    const stdout = execSync("node scripts/check-iframe-sandbox.mjs", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

describe("check-iframe-sandbox gate", () => {
  it("passa quando iframes usam sandbox seguro", () => {
    const dir = makeSandbox({
      "src/Safe.tsx":
        'export const F = () => <iframe sandbox="allow-scripts allow-presentation" src="x" />;',
    });
    try {
      const result = run(dir);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("0 violações");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falha quando iframe combina allow-scripts + allow-same-origin", () => {
    const dir = makeSandbox({
      "src/Unsafe.tsx":
        'export const F = () => <iframe sandbox="allow-scripts allow-same-origin" src="x" />;',
    });
    try {
      const result = run(dir);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("1 violação");
      expect(result.stderr).toContain("src/Unsafe.tsx");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("respeita allowlist para casos justificados", () => {
    const dir = makeSandbox(
      {
        "src/Justified.tsx":
          'export const F = () => <iframe sandbox="allow-scripts allow-same-origin" src="x" />;',
      },
      ["src/Justified.tsx:1"],
    );
    try {
      const result = run(dir);
      expect(result.code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignora ordem dos tokens e case", () => {
    const dir = makeSandbox({
      "src/UnsafeOrder.tsx":
        'export const F = () => <iframe sandbox="ALLOW-SAME-ORIGIN allow-popups allow-scripts" src="x" />;',
    });
    try {
      const result = run(dir);
      expect(result.code).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
