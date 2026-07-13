#!/usr/bin/env node
/**
 * dry-run-migration-draft.mjs
 * --------------------------------------------------------------------------
 * Executa um rascunho de `qa/migrations-draft/*.sql` dentro de uma transação
 * que termina em ROLLBACK — o banco fica intacto, mas conseguimos validar:
 *
 *   1. Sintaxe SQL (o statement executa até o COMMIT do draft).
 *   2. Assinaturas das funções alvo existem em pg_proc.
 *   3. Diff de ACL previsto (antes vs depois da execução do draft).
 *
 * Escopo restrito: drafts que só fazem REVOKE/GRANT ... ON FUNCTION public.X(...).
 * Detecta DDL não-transacional (CREATE INDEX CONCURRENTLY, VACUUM, REINDEX,
 * ALTER SYSTEM) e recusa o dry-run com mensagem clara.
 *
 * Uso:
 *   node scripts/dry-run-migration-draft.mjs <path-do-draft.sql>
 *
 * Requer PG* env vars (PGHOST/PGUSER/PGPASSWORD/PGDATABASE[/PGPORT]).
 * Sem credenciais → warning + exit 0 (safe-by-default, igual ao drift-check).
 *
 * Saída: exit 0 em sucesso, 1 em falha real (SQL quebrou, assinatura ausente,
 * DDL não-suportado). Nunca escreve no banco (usa BEGIN + ROLLBACK explícito).
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, basename } from "node:path";

const NON_TX_DDL = [
  /CREATE\s+INDEX\s+CONCURRENTLY/i,
  /DROP\s+INDEX\s+CONCURRENTLY/i,
  /REINDEX\s+.*CONCURRENTLY/i,
  /VACUUM\b/i,
  /ALTER\s+SYSTEM\b/i,
];

const FN_STMT_RE =
  /\b(?:REVOKE|GRANT)\s+[A-Z ,]*?\bON\s+FUNCTION\s+(?:public\.)?([a-z0-9_]+)\s*\(([^)]*)\)/gi;

function log(msg) {
  process.stdout.write(msg + "\n");
}
function err(msg) {
  process.stderr.write(msg + "\n");
}

function psql(sql, { silent = false } = {}) {
  try {
    return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-Atq", "-c", sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", silent ? "pipe" : "inherit"],
    });
  } catch (e) {
    const stderr = e.stderr?.toString?.() ?? "";
    const errOut = new Error(stderr || e.message);
    errOut.stderr = stderr;
    throw errOut;
  }
}

function psqlFile(sqlText) {
  // Executa um script SQL multi-statement via stdin.
  try {
    return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-Atq", "-f", "-"], {
      encoding: "utf8",
      input: sqlText,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    const stderr = e.stderr?.toString?.() ?? "";
    const errOut = new Error(stderr || e.message);
    errOut.stderr = stderr;
    throw errOut;
  }
}

function snapshotAcl(fnNames) {
  if (!fnNames.length) return {};
  const list = fnNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(",");
  const sql = `
    SELECT p.proname
        || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')'
        || E'\\t'
        || COALESCE(pg_catalog.array_to_string(p.proacl, ','), '')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (${list})
     ORDER BY 1;
  `;
  const out = psql(sql, { silent: true });
  const map = {};
  for (const line of out.split("\n").filter(Boolean)) {
    const [sig, acl] = line.split("\t");
    map[sig] = acl || "";
  }
  return map;
}

function parseAclEntry(entry) {
  // formato: role=privs/grantor ; role vazio = PUBLIC
  const m = /^([^=]*)=([^/]*)\/(.+)$/.exec(entry);
  if (!m) return null;
  const role = m[1] === "" ? "PUBLIC" : m[1];
  return { role, privs: m[2] };
}

function diffAcl(before, after) {
  const parse = (raw) => {
    const set = new Set();
    if (!raw) return set;
    for (const entry of raw.split(",").filter(Boolean)) {
      const p = parseAclEntry(entry);
      if (p && p.privs.includes("X")) set.add(p.role);
    }
    return set;
  };
  const b = parse(before);
  const a = parse(after);
  const added = [...a].filter((r) => !b.has(r));
  const removed = [...b].filter((r) => !a.has(r));
  return { added, removed };
}

async function main() {
  const draftArg = process.argv[2];
  if (!draftArg) {
    err("Uso: node scripts/dry-run-migration-draft.mjs <draft.sql>");
    process.exit(2);
  }
  const draftPath = resolve(draftArg);
  if (!existsSync(draftPath)) {
    err(`Draft não encontrado: ${draftPath}`);
    process.exit(2);
  }

  const draftName = basename(draftPath);
  const sql = readFileSync(draftPath, "utf8");

  // Guarda safe-by-default: sem PG env → skip.
  if (!process.env.PGHOST) {
    log(`⚠️  PGHOST ausente — dry-run de ${draftName} PULADO (safe-by-default).`);
    log("   Configure PGHOST/PGUSER/PGPASSWORD/PGDATABASE para habilitar.");
    process.exit(0);
  }

  // Recusa DDL não-transacional.
  for (const re of NON_TX_DDL) {
    if (re.test(sql)) {
      err(
        `❌ Draft contém DDL não-transacional (${re.source}). Dry-run recusa — ` +
          `execute revisão manual + db-schema-drift-check em vez.`,
      );
      process.exit(1);
    }
  }

  // Extrai funções alvo.
  const seen = new Map(); // name -> Set<args>
  for (const m of sql.matchAll(FN_STMT_RE)) {
    const name = m[1].toLowerCase();
    const args = m[2].trim().replace(/\s+/g, " ");
    if (!seen.has(name)) seen.set(name, new Set());
    seen.get(name).add(args);
  }
  const fnNames = [...seen.keys()];

  log(`\nDraft: ${draftName}`);
  if (!fnNames.length) {
    log("Nenhuma função pública identificada em REVOKE/GRANT ON FUNCTION.");
    log("(Escopo do dry-run é ACL de função — outros DDLs precisam de revisão manual.)");
  } else {
    log(`Funções tocadas: ${fnNames.length}`);
  }

  // Snapshot ANTES.
  let before, after;
  try {
    before = snapshotAcl(fnNames);
  } catch (e) {
    err(`❌ Falha lendo pg_proc (antes):\n${e.stderr || e.message}`);
    process.exit(1);
  }

  // Verifica assinaturas existentes.
  const missing = [];
  for (const [name, argsSet] of seen) {
    const foundSigs = Object.keys(before).filter((s) => s.startsWith(`${name}(`));
    if (!foundSigs.length) {
      missing.push(`${name}(...)`);
      continue;
    }
    // Sanity check: cada args declarado no draft deveria bater com alguma sig.
    for (const args of argsSet) {
      const normArgs = args.replace(/\s+/g, " ").trim();
      const hit = foundSigs.some((s) =>
        s
          .slice(name.length + 1, -1)
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
          .includes(normArgs.toLowerCase()),
      );
      if (!hit && normArgs) {
        err(
          `⚠️  Assinatura declarada no draft não encontrada exatamente: ` +
            `${name}(${args}). Sigs reais: ${foundSigs.join(", ")}`,
        );
      }
    }
  }
  if (missing.length) {
    err(`❌ Funções ausentes no banco: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Executa em transação e sempre reverte.
  const wrapped =
    "BEGIN;\n" +
    "-- draft begin --\n" +
    // Remove BEGIN/COMMIT do próprio draft para evitar transação aninhada
    // (o Postgres emite WARNING e faz commit implícito). Substituímos por
    // SAVEPOINT interno inócuo para manter a semântica atômica.
    sql
      .replace(/^\s*BEGIN\s*;/gim, "SAVEPOINT dry_run_draft;")
      .replace(/^\s*COMMIT\s*;/gim, "RELEASE SAVEPOINT dry_run_draft;") +
    "\n-- draft end --\n" +
    "ROLLBACK;\n";

  // Executa: snapshot ANTES já feito acima; agora rodamos wrapped num
  // pipeline separado, e depois snapshot pós-rollback (deve == antes).
  // Para capturar o estado DENTRO da transação, usamos DO block que grava
  // em temp table — mas essa temp cai no ROLLBACK. Alternativa mais simples:
  // rodar duas conexões não serve (não vêem tx uncommitted). Solução:
  // usar RAISE NOTICE dentro do DO após aplicar o draft.
  //
  // Estratégia final: injetamos, logo antes do ROLLBACK, uma query que
  // imprime o ACL corrente via `\echo` + SELECT, capturando o resultado
  // no stdout do psql.
  const list = fnNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(",");
  const probe = fnNames.length
    ? `
      \\echo __ACL_AFTER_BEGIN__
      SELECT p.proname
          || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')'
          || E'\\t'
          || COALESCE(pg_catalog.array_to_string(p.proacl, ','), '')
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN (${list})
       ORDER BY 1;
      \\echo __ACL_AFTER_END__
    `
    : "";
  const script =
    "BEGIN;\n" +
    sql
      .replace(/^\s*BEGIN\s*;/gim, "SAVEPOINT dry_run_draft;")
      .replace(/^\s*COMMIT\s*;/gim, "RELEASE SAVEPOINT dry_run_draft;") +
    "\n" +
    probe +
    "\nROLLBACK;\n";

  let out;
  try {
    out = psqlFile(script);
  } catch (e) {
    err(`\n❌ Draft falhou durante o dry-run:\n${e.stderr || e.message}`);
    process.exit(1);
  }

  // Parse probe output.
  after = {};
  const startTok = "__ACL_AFTER_BEGIN__";
  const endTok = "__ACL_AFTER_END__";
  const si = out.indexOf(startTok);
  const ei = out.indexOf(endTok);
  if (si !== -1 && ei !== -1) {
    const block = out.slice(si + startTok.length, ei).trim();
    for (const line of block.split("\n").filter(Boolean)) {
      const [sig, acl] = line.split("\t");
      if (sig) after[sig] = acl || "";
    }
  }

  // Snapshot pós-rollback (sanity check: DEVE == before).
  const postRollback = snapshotAcl(fnNames);
  const drifted = fnNames.some((n) => {
    const bSig = Object.keys(before).find((s) => s.startsWith(`${n}(`));
    const pSig = Object.keys(postRollback).find((s) => s.startsWith(`${n}(`));
    return before[bSig] !== postRollback[pSig];
  });
  if (drifted) {
    err(
      "❌ Estado pós-rollback difere do estado inicial. Isso NÃO deveria acontecer — " +
        "possível statement não-transacional escondido ou falha no ROLLBACK. Investigar imediatamente.",
    );
    process.exit(1);
  }

  // Imprime diff.
  log("");
  log("Diff de ACL (dentro da tx, antes → depois):");
  let anyChange = false;
  for (const [sig, aclBefore] of Object.entries(before)) {
    const aclAfter = after[sig] ?? aclBefore;
    const { added, removed } = diffAcl(aclBefore, aclAfter);
    if (!added.length && !removed.length) {
      log(`  ${sig}   (sem mudança)`);
      continue;
    }
    anyChange = true;
    const parts = [
      ...removed.map((r) => `-${r}`),
      ...added.map((r) => `+${r}`),
    ];
    log(`  ${sig}   ${parts.join(" ")}`);
  }

  log("");
  log("Rollback: OK — nenhuma mudança persistida no banco.");
  if (!anyChange && fnNames.length) {
    log(
      "Nota: draft não produziu diff de ACL — provavelmente já é idempotente com o estado atual.",
    );
  }

  process.exit(0);
}

main().catch((e) => {
  err(`❌ Erro inesperado: ${e.stack || e.message}`);
  process.exit(1);
});
