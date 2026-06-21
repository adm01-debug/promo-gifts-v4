#!/usr/bin/env node
/**
 * check-required-checks.mjs
 * ----------------------------------------------------------------------------
 * SSOT: .github/required-checks.json
 *
 * Suporta DUAS shapes (retrocompatível):
 *
 *   Legacy:
 *     { branch: "main", required_checks: [...] }
 *
 *   Multi-ruleset (recomendado):
 *     {
 *       rulesets: [
 *         { id, branches: ["main"], required_checks: [...] },
 *         { id, branchPatterns: ["release/*"], required_checks: [...] }
 *       ]
 *     }
 *
 * Validações:
 *   (A) WORKFLOW PRESENCE — para cada check em qualquer ruleset, verifica
 *       que o `workflow` existe E contém um job com `name:` IDÊNTICO ao
 *       declarado. Falha o build se houver drift (exit 1).
 *
 *   (B) BRANCH PROTECTION SYNC (best-effort, não bloqueante) — para cada
 *       ruleset, resolve as branches concretas (explícitas + expansão dos
 *       padrões glob via /repos/{repo}/branches) e consulta
 *       /branches/{branch}/protection/required_status_checks. Emite
 *       warning quando algum check da SSOT NÃO está marcado como required
 *       na branch concreta. Requer GH_TOKEN com administration:read;
 *       sem ele, pula silenciosamente.
 *
 * Exit codes:
 *   0  — ok (ou apenas warnings em B / falta de token)
 *   1  — drift em (A): SSOT aponta para nome/workflow inexistente,
 *        ou SSOT malformado.
 *
 * Uso:
 *   node scripts/check-required-checks.mjs
 *   GH_TOKEN=ghp_xxx GITHUB_REPOSITORY=owner/repo node scripts/check-required-checks.mjs
 * ----------------------------------------------------------------------------
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SSOT_PATH = ".github/required-checks.json";

const fail = (m) => { console.error(`::error::${m}`); process.exit(1); };
const warn = (m) => console.warn(`::warning::${m}`);
const info = (m) => console.log(m);

// ---------------------------------------------------------------------------
// Carrega + normaliza SSOT em formato multi-ruleset
// ---------------------------------------------------------------------------
if (!existsSync(SSOT_PATH)) fail(`SSOT ausente: ${SSOT_PATH}`);
let ssot;
try { ssot = JSON.parse(readFileSync(SSOT_PATH, "utf8")); }
catch (e) { fail(`SSOT inválido (${SSOT_PATH}): ${e.message}`); }

/** @type {{id:string, branches:string[], branchPatterns:string[], required_checks:any[]}[]} */
let rulesets = [];
if (Array.isArray(ssot.rulesets)) {
  rulesets = ssot.rulesets.map((r, i) => ({
    id: r.id || `ruleset-${i}`,
    branches: Array.isArray(r.branches) ? r.branches : [],
    branchPatterns: Array.isArray(r.branchPatterns) ? r.branchPatterns : [],
    required_checks: Array.isArray(r.required_checks) ? r.required_checks : [],
  }));
} else if (Array.isArray(ssot.required_checks)) {
  // Shape legacy
  rulesets = [{
    id: "legacy",
    branches: [ssot.branch || "main"],
    branchPatterns: [],
    required_checks: ssot.required_checks,
  }];
} else {
  fail(`SSOT sem 'rulesets' nem 'required_checks' em ${SSOT_PATH}.`);
}

if (rulesets.length === 0) {
  warn(`Nenhum ruleset declarado em ${SSOT_PATH} — nada a validar.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// (A) WORKFLOW PRESENCE  — falha se drift
// ---------------------------------------------------------------------------
let driftA = 0;
const seen = new Set(); // dedupe por (workflow|name) — mesmo check pode aparecer em vários rulesets

for (const rs of rulesets) {
  if (rs.required_checks.length === 0) {
    warn(`Ruleset '${rs.id}' sem required_checks.`);
    continue;
  }
  for (const item of rs.required_checks) {
    const { name, workflow } = item;
    if (!name || !workflow) {
      console.error(`::error file=${SSOT_PATH}::ruleset '${rs.id}': item inválido ${JSON.stringify(item)}`);
      driftA++; continue;
    }
    const key = `${workflow}|${name}`;
    if (seen.has(key)) { info(`✓ (cached) ${name} ← ${workflow}`); continue; }
    seen.add(key);

    const wfPath = resolve(workflow);
    if (!existsSync(wfPath)) {
      console.error(`::error file=${SSOT_PATH}::ruleset '${rs.id}': workflow não existe: ${workflow}`);
      driftA++; continue;
    }
    const wf = readFileSync(wfPath, "utf8");
    const variants = [
      `name: ${name}`,
      `name: '${name.replaceAll("'", "''")}'`,
      `name: "${name.replaceAll('"', '\\"')}"`,
    ];
    if (!variants.some((v) => wf.includes(v))) {
      console.error(
        `::error file=${workflow}::ruleset '${rs.id}': required check "${name}" não encontrado como \`name:\` no workflow. ` +
        `Ajuste o SSOT ou o name: do job para baterem exatamente.`
      );
      driftA++;
    } else {
      info(`✓ [${rs.id}] ${name} ← ${workflow}`);
    }
  }
}
if (driftA > 0) fail(`${driftA} required check(s) com drift entre SSOT e workflows.`);

// ---------------------------------------------------------------------------
// (B) BRANCH PROTECTION SYNC  — best-effort, não bloqueante
// ---------------------------------------------------------------------------
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo) {
  info("ℹ︎  GH_TOKEN/GITHUB_REPOSITORY ausentes — pulando sync com Branch Protection.");
  process.exit(0);
}

const gh = async (path) => {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  return r;
};

// Glob simples: '*' = qualquer coisa exceto '/', '**' = qualquer coisa
const globToRegex = (g) => {
  const re = g
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLESTAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLESTAR::/g, ".*");
  return new RegExp(`^${re}$`);
};

// Lista branches concretas do repo (paginado, até 500 — suficiente para release/*)
let allBranches = null;
const ensureBranches = async () => {
  if (allBranches) return allBranches;
  allBranches = [];
  for (let page = 1; page <= 5; page++) {
    const r = await gh(`/repos/${repo}/branches?per_page=100&page=${page}`);
    if (!r.ok) { warn(`GitHub API ${r.status} ao listar branches: ${await r.text()}`); break; }
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) break;
    allBranches.push(...arr.map((b) => b.name));
    if (arr.length < 100) break;
  }
  return allBranches;
};

const resolveBranches = async (rs) => {
  const out = new Set(rs.branches);
  if (rs.branchPatterns.length > 0) {
    const bs = await ensureBranches();
    for (const pat of rs.branchPatterns) {
      const re = globToRegex(pat);
      for (const b of bs) if (re.test(b)) out.add(b);
    }
  }
  return [...out];
};

let warned = 0;
for (const rs of rulesets) {
  const branches = await resolveBranches(rs);
  if (branches.length === 0) {
    info(`ℹ︎  [${rs.id}] nenhum branch concreto resolvido (padrões: ${rs.branchPatterns.join(", ") || "—"}) — pulando.`);
    continue;
  }
  const required = rs.required_checks.map((r) => r.name);
  for (const branch of branches) {
    const r = await gh(`/repos/${repo}/branches/${encodeURIComponent(branch)}/protection/required_status_checks`);
    if (r.status === 404) { warn(`[${rs.id}] Branch Protection ausente em ${branch} (ou required_status_checks não configurado).`); warned++; continue; }
    if (r.status === 403) { warn(`[${rs.id}] GH_TOKEN sem permissão administration:read — não consigo validar ${branch}.`); warned++; continue; }
    if (!r.ok) { warn(`[${rs.id}] GitHub API ${r.status} em ${branch}: ${await r.text()}`); warned++; continue; }
    const data = await r.json();
    const remote = new Set([
      ...(data.contexts || []),
      ...((data.checks || []).map((c) => c.context).filter(Boolean)),
    ]);
    const missing = required.filter((n) => !remote.has(n));
    if (missing.length === 0) {
      info(`✓ [${rs.id}] ${branch}: ${required.length} required check(s) presentes.`);
    } else {
      warn(
        `[${rs.id}] ${branch} NÃO inclui ${missing.length} required check(s):\n` +
        missing.map((m) => `  • ${m}`).join("\n") +
        `\n  → https://github.com/${repo}/settings/branches`
      );
      warned++;
    }
  }
}

info(warned === 0 ? "✓ Branch Protection alinhado com SSOT em todos os rulesets." : `⚠ ${warned} aviso(s) de sync (não bloqueante).`);
process.exit(0);
