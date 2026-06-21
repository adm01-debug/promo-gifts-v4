#!/usr/bin/env node
/**
 * check-required-checks.mjs
 * ----------------------------------------------------------------------------
 * Garante a integridade da lista de required status checks declarada em
 * `.github/required-checks.json` (SSOT):
 *
 *   (A) WORKFLOW PRESENCE — para cada item, verifica que o arquivo
 *       `workflow` existe E contém um job com `name:` IDÊNTICO ao do SSOT.
 *       Isto impede que renomeações silenciosas do `name:` quebrem o
 *       Branch Protection (que matcha por string exata).
 *
 *   (B) BRANCH PROTECTION SYNC (opcional) — se a env GH_TOKEN tiver
 *       permissão `administration:read` no repo, consulta a API
 *       /branches/{branch}/protection/required_status_checks e avisa
 *       quando algum check da SSOT NÃO está marcado como required.
 *       Se a API responder 403/404 (token sem permissão / proteção
 *       ausente), emite warning não-bloqueante (modo informativo).
 *
 * Exit codes:
 *   0  — tudo ok (ou apenas warnings na parte B)
 *   1  — drift detectado em (A): SSOT aponta para nome/workflow inexistente.
 *
 * Uso local:
 *   node scripts/check-required-checks.mjs
 *   GH_TOKEN=ghp_xxx GITHUB_REPOSITORY=owner/repo node scripts/check-required-checks.mjs
 * ----------------------------------------------------------------------------
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SSOT_PATH = ".github/required-checks.json";

function fail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}
function warn(msg) {
  console.warn(`::warning::${msg}`);
}
function info(msg) {
  console.log(msg);
}

// ---------------------------------------------------------------------------
// (A) WORKFLOW PRESENCE
// ---------------------------------------------------------------------------
if (!existsSync(SSOT_PATH)) fail(`SSOT ausente: ${SSOT_PATH}`);

let ssot;
try {
  ssot = JSON.parse(readFileSync(SSOT_PATH, "utf8"));
} catch (e) {
  fail(`SSOT inválido (${SSOT_PATH}): ${e.message}`);
}
const required = Array.isArray(ssot.required_checks) ? ssot.required_checks : [];
const branch = ssot.branch || "main";

if (required.length === 0) {
  warn(`Nenhum required check declarado em ${SSOT_PATH} — nada a validar.`);
  process.exit(0);
}

let driftA = 0;
for (const item of required) {
  const { name, workflow } = item;
  if (!name || !workflow) {
    console.error(`::error file=${SSOT_PATH}::item inválido (faltando name/workflow): ${JSON.stringify(item)}`);
    driftA++;
    continue;
  }
  const wfPath = resolve(workflow);
  if (!existsSync(wfPath)) {
    console.error(`::error file=${SSOT_PATH}::workflow não existe: ${workflow}`);
    driftA++;
    continue;
  }
  const wf = readFileSync(wfPath, "utf8");
  // Match `name: <value>` aceitando aspas simples/duplas/sem aspas.
  // Importante: o GitHub usa o `name:` do JOB (não do step nem do workflow)
  // como display string do status check. Procuramos qualquer ocorrência
  // exata no arquivo — colisões com workflow-level são improváveis aqui
  // (e quando ocorrem, o nome ainda bate).
  const variants = [
    `name: ${name}`,
    `name: '${name.replaceAll("'", "''")}'`,
    `name: "${name.replaceAll('"', '\\"')}"`,
  ];
  const found = variants.some((v) => wf.includes(v));
  if (!found) {
    console.error(
      `::error file=${workflow}::required check "${name}" não encontrado como \`name:\` no workflow. ` +
        `Atualize o SSOT (${SSOT_PATH}) OU o campo name: do job para que batam exatamente.`
    );
    driftA++;
  } else {
    info(`✓ ${name}  ←  ${workflow}`);
  }
}

if (driftA > 0) {
  fail(`${driftA} required check(s) com drift entre SSOT e workflows.`);
}

// ---------------------------------------------------------------------------
// (B) BRANCH PROTECTION SYNC (best-effort, não bloqueante)
// ---------------------------------------------------------------------------
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo) {
  info("ℹ︎  GH_TOKEN/GITHUB_REPOSITORY ausentes — pulando sync com Branch Protection.");
  process.exit(0);
}

const url = `https://api.github.com/repos/${repo}/branches/${branch}/protection/required_status_checks`;
let res;
try {
  res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
} catch (e) {
  warn(`Falha de rede ao consultar Branch Protection: ${e.message}`);
  process.exit(0);
}

if (res.status === 404) {
  warn(`Branch Protection ausente em ${repo}@${branch} (ou required_status_checks não configurado).`);
  process.exit(0);
}
if (res.status === 403) {
  warn(`GH_TOKEN sem permissão administration:read — não consigo validar required_status_checks remotamente.`);
  process.exit(0);
}
if (!res.ok) {
  warn(`GitHub API ${res.status}: ${await res.text()}`);
  process.exit(0);
}

const data = await res.json();
const remote = new Set([
  ...(data.contexts || []),
  ...((data.checks || []).map((c) => c.context).filter(Boolean)),
]);

const missing = required.map((r) => r.name).filter((n) => !remote.has(n));
if (missing.length === 0) {
  info(`✓ Branch Protection em ${branch}: todos os ${required.length} required check(s) presentes.`);
  process.exit(0);
}

warn(
  `Branch Protection em ${branch} NÃO inclui ${missing.length} required check(s) declarado(s) no SSOT:\n` +
    missing.map((m) => `  • ${m}`).join("\n") +
    `\nConfigure em: https://github.com/${repo}/settings/branches`
);
process.exit(0);
