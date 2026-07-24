#!/usr/bin/env node
/**
 * Roda a suíte E2E de "Desfazer" nos orçamentos (04o + 04p + 04q).
 *
 * MODOS
 *   ─────
 *   1) **Modo real** (default): usa `E2E_USER_EMAIL` + `E2E_USER_PASSWORD`.
 *      O `auth.setup` faz login via UI e grava `e2e/.auth/storageState.json`.
 *
 *   2) **Modo mock** (`--mock` ou `E2E_MOCK_AUTH=1`): não exige credenciais.
 *      Executa `scripts/e2e-mock-auth-setup.mjs` para gerar um storageState
 *      sintético e ativa `E2E_MOCK_AUTH=1` para os specs. Os specs em 04o/04p/04q
 *      chamam `installMockAuth(page)` no `beforeEach` para interceptar
 *      `/auth/v1/**` — assim o Supabase JS mantém a sessão local viva sem
 *      contatar o servidor real. Todas as chamadas a `/rest/v1/quotes` já
 *      são interceptadas pelos próprios specs.
 *
 * USO
 *   ────
 *   # real
 *   E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run test:e2e:quotes-undo
 *   # mock (sem credenciais)
 *   npm run test:e2e:quotes-undo:mock
 *   # extras
 *   npm run test:e2e:quotes-undo -- --headed
 *   npm run test:e2e:quotes-undo -- --workers=2 --project=chromium-authed
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SPECS = [
  "e2e/flows/04o-quotes-single-delete-undo.spec.ts",
  "e2e/flows/04p-quotes-bulk-delete-undo.spec.ts",
  "e2e/flows/04q-quotes-single-delete-undo-edge-cases.spec.ts",
  "e2e/flows/04r-undo-toast-a11y-keyboard.spec.ts",
  "e2e/flows/04s-quotes-duplicate-undo-a11y-rapid.spec.ts",
];

// ─── 1) Sanidade: specs existem ─────────────────────────────────────────
const missing = SPECS.filter((s) => !existsSync(path.join(ROOT, s)));
if (missing.length > 0) {
  console.error("❌ Specs E2E ausentes:");
  for (const m of missing) console.error(`   • ${m}`);
  process.exit(1);
}

// ─── 2) Parse de flags ──────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const mockFlagIndex = rawArgs.findIndex((a) => a === "--mock" || a === "--mock-auth");
const isMock = mockFlagIndex !== -1 || process.env.E2E_MOCK_AUTH === "1";
const passthrough = rawArgs.filter((_, i) => i !== mockFlagIndex);

// ─── 3) Modo mock: gera storageState sintético ──────────────────────────
if (isMock) {
  process.env.E2E_MOCK_AUTH = "1";
  console.log("🎭 Modo MOCK ativado — sem credenciais reais.");
  const setup = spawnSync(
    "node",
    [path.join("scripts", "e2e-mock-auth-setup.mjs")],
    { stdio: "inherit", cwd: ROOT, env: process.env },
  );
  if ((setup.status ?? 1) !== 0) {
    console.error("❌ Falha ao gerar storageState mock.");
    process.exit(setup.status ?? 1);
  }
} else {
  // Modo real: normaliza aliases E2E_USER / TEST_USER → E2E_USER_EMAIL/PASSWORD
  const email =
    process.env.E2E_USER_EMAIL ??
    process.env.E2E_USER ??
    process.env.TEST_USER ??
    "";
  const password =
    process.env.E2E_USER_PASSWORD ??
    process.env.E2E_PASS ??
    process.env.TEST_PASS ??
    "";
  if (!email || !password) {
    console.error(
      "❌ Credenciais E2E ausentes. Escolha um modo:\n" +
        "   • Modo REAL: defina E2E_USER_EMAIL + E2E_USER_PASSWORD\n" +
        "   • Modo MOCK: use `npm run test:e2e:quotes-undo:mock` (sem credenciais)\n",
    );
    process.exit(2);
  }
  process.env.E2E_USER_EMAIL = email;
  process.env.E2E_USER_PASSWORD = password;
}

// ─── 4) Monta comando Playwright ────────────────────────────────────────
const project = process.env.E2E_PROJECT ?? "chromium-authed";
const hasProjectArg = passthrough.some((a) => a.startsWith("--project"));

const args = ["playwright", "test", ...SPECS];
if (!hasProjectArg) args.push(`--project=${project}`);
args.push(...passthrough);

console.log("▶ Rodando E2E: exclusão de orçamentos com Desfazer");
console.log(`   Specs:   ${SPECS.length}`);
console.log(`   Project: ${hasProjectArg ? "(override)" : project}`);
console.log(`   Modo:    ${isMock ? "MOCK (sem credenciais)" : "REAL (Supabase)"}`);
if (!isMock && process.env.E2E_USER_EMAIL) {
  console.log(
    `   User:    ${process.env.E2E_USER_EMAIL.replace(/(.{2}).+(@.+)/, "$1***$2")}`,
  );
}

// Guarda contra "silent green": se o Playwright for chamado com `--list`
// e reportar 0 testes, o exit code natural do binário é 0 — o que faria
// o CI passar mesmo com erros de coleta (imports quebrados, glob errado).
// Capturamos stdout+stderr APENAS quando `--list` está presente e
// promovemos para exit=3 se a saída contiver "Total: 0 tests".
const isListMode = passthrough.includes("--list");

if (isListMode) {
  const result = spawnSync("npx", args, {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: ROOT,
    env: process.env,
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (/Total:\s*0\s*tests/i.test(combined) || /No tests found/i.test(combined)) {
    console.error(
      "\n❌ Falha de coleta: Playwright encontrou 0 testes. " +
        "Provável erro de import (ex.: export ausente em helpers). " +
        "Verifique o output acima e não confie no exit=0 do modo --list.",
    );
    process.exit(3);
  }
  process.exit(result.status ?? 1);
}

const result = spawnSync("npx", args, {
  stdio: "inherit",
  cwd: ROOT,
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
