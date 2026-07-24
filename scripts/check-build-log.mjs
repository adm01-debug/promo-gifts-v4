#!/usr/bin/env node
/**
 * check-build-log.mjs
 *
 * Analisa o build.log gerado pelo passo anterior do CI
 * (`npm run build 2>&1 | tee build.log`) e falha se encontrar
 * warnings/erros impeditivos — sem precisar re-executar o build.
 *
 * Usado por: npm run ci:build:warnings (step "Build warnings gate" no CI)
 */
import { readFileSync, existsSync } from "node:fs";

const LOG_PATH = "build.log";

const stripAnsi = (value) =>
  value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");

const warningPatterns = [
  /\[vite:.*\]/i,         // Erros de plugins do Vite
  /\[rollup:.*\]/i,       // Erros do Rollup
  /TS\d+: /i,             // Erros do TypeScript (ex: TS2322)
  /error/i,               // Padrão genérico de erro
  /warning/i,             // Padrão genérico de warning
  /Unused/i,              // Código não utilizado
  /Expected/i,            // Erros de sintaxe/parsing
  /console\.(warn|error)/i, // Mensagens emitidas durante build/SSR
];

const allowedExceptions = [
  "npm warn",
  "PostCSS plugin did not pass the `from` option",
  "dynamic import will not move module into another chunk",
  "Entry module \"src/main.tsx\" is using named and default exports together",
  "Circular dependency",
];

if (!existsSync(LOG_PATH)) {
  console.error(`❌ ${LOG_PATH} não encontrado. Execute o build antes deste step.`);
  process.exit(1);
}

const content = readFileSync(LOG_PATH, "utf8");
const lines = content.split("\n");
const foundWarnings = [];

for (const line of lines) {
  const cleanLine = stripAnsi(line).trim();
  if (!cleanLine) continue;
  if (cleanLine.startsWith("dist/")) continue;
  if (allowedExceptions.some((exc) => cleanLine.includes(exc))) continue;
  if (warningPatterns.some((pat) => pat.test(cleanLine))) {
    foundWarnings.push(cleanLine);
  }
}

console.log(`📋 Analisando ${LOG_PATH} (${lines.length} linhas)…`);

if (foundWarnings.length > 0) {
  console.error(
    `❌ Build concluído, mas foram encontrados ${foundWarnings.length} warnings/erros impeditivos:`
  );
  foundWarnings.slice(0, 20).forEach((w) => console.error(`   - ${w}`));
  if (foundWarnings.length > 20)
    console.error(`   … e mais ${foundWarnings.length - 20} warnings.`);
  process.exit(1);
}

console.log("✅ Build log sem warnings detectados!");
process.exit(0);
