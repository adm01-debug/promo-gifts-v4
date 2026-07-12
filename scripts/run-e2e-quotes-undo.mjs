#!/usr/bin/env node
/**
 * Roda a suíte E2E de "Desfazer" nos orçamentos (04o + 04p + 04q).
 *
 * Uso:
 *   npm run test:e2e:quotes-undo
 *   npm run test:e2e:quotes-undo -- --headed
 *   npm run test:e2e:quotes-undo -- --ui
 *   npm run test:e2e:quotes-undo -- --workers=1
 *
 * Variáveis de ambiente obrigatórias (credenciais de E2E autenticado):
 *   E2E_USER  ou  TEST_USER   → e-mail do usuário de teste
 *   E2E_PASS  ou  TEST_PASS   → senha do usuário de teste
 *
 * Variáveis opcionais:
 *   E2E_BASE_URL              → base URL do preview (default: usa playwright.config)
 *   E2E_PROJECT               → project Playwright (default: chromium-authed)
 *
 * O script valida as credenciais ANTES de invocar o Playwright, para
 * abortar rápido com mensagem PT-BR clara em vez de deixar a suíte
 * falhar em runtime com erro genérico de auth.
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
];

// 1) Confirma que os arquivos de spec existem no repo
const missing = SPECS.filter((s) => !existsSync(path.join(ROOT, s)));
if (missing.length > 0) {
  console.error("❌ Specs E2E ausentes:");
  for (const m of missing) console.error(`   • ${m}`);
  process.exit(1);
}

// 2) Normaliza credenciais (aceita E2E_* ou TEST_*)
const user = process.env.E2E_USER ?? process.env.TEST_USER ?? "";
const pass = process.env.E2E_PASS ?? process.env.TEST_PASS ?? "";
if (!user || !pass) {
  console.error(
    "❌ Credenciais E2E ausentes. Defina E2E_USER/E2E_PASS (ou TEST_USER/TEST_PASS) antes de rodar.\n" +
      "   Exemplo:\n" +
      "     E2E_USER=qa@promogifts.com.br E2E_PASS='***' npm run test:e2e:quotes-undo",
  );
  process.exit(2);
}
// Reexporta em ambos os nomes para o Playwright encontrar qualquer variante.
process.env.E2E_USER = user;
process.env.E2E_PASS = pass;
process.env.TEST_USER = user;
process.env.TEST_PASS = pass;

// 3) Monta argumentos do Playwright
const passthrough = process.argv.slice(2);
const project = process.env.E2E_PROJECT ?? "chromium-authed";
const hasProjectArg = passthrough.some((a) => a.startsWith("--project"));

const args = ["playwright", "test", ...SPECS];
if (!hasProjectArg) args.push(`--project=${project}`);
args.push(...passthrough);

// 4) Executa
console.log("▶ Rodando E2E: exclusão de orçamentos com Desfazer");
console.log(`   Specs:   ${SPECS.length}`);
console.log(`   Project: ${hasProjectArg ? "(override)" : project}`);
console.log(`   User:    ${user.replace(/(.{2}).+(@.+)/, "$1***$2")}`);

const result = spawnSync("npx", args, {
  stdio: "inherit",
  cwd: ROOT,
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
