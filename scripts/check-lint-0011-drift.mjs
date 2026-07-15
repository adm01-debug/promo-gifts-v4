#!/usr/bin/env node
/**
 * check-lint-0011-drift.mjs
 *
 * Falha se surgir uma função em `public.*` sem `SET search_path` configurado
 * (Supabase lint 0011 — `function_search_path_mutable`), que NÃO esteja
 * documentada em `.security/lint-0011-allowlist.json`.
 *
 * Por que importa: sem `SET search_path`, uma função pode ser resolvida
 * contra objetos plantados por um atacante em schemas no `search_path` da
 * sessão (vetor de escalada de privilégio quando combinado com SECURITY
 * DEFINER). Snapshot 2026-07-15: 0 violações → o gate trava regressões.
 *
 * Fontes de dados (na ordem):
 *   1. `--from-file=<path.json>` — lista `[{fn:string}, ...]` (usado em testes).
 *   2. `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — consulta pg-meta.
 *   3. Sem nenhum dos dois → skip com warning (não falha CI local).
 *
 * Modo interativo do PO:
 *   `--update-allowlist` grava o snapshot atual em disco (usar apenas
 *   após revisão humana das novas funções).
 *
 * Exit codes: 0 (ok/skip), 1 (drift — falha), 2 (erro de config).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ALLOWLIST_PATH = path.join(ROOT, '.security/lint-0011-allowlist.json');

const argv = process.argv.slice(2);
const fromFileArg = argv.find((a) => a.startsWith('--from-file='));
const UPDATE = argv.includes('--update-allowlist');

const SQL = `
  SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS fn
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.prokind IN ('f','p')
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%'
      )
    )
  ORDER BY 1;
`.trim();

async function fetchLive() {
  const URL = process.env.VITE_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) return null;
  const endpoint = `${URL.replace(/\/$/, '')}/pg-meta/default/query`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });
  if (!res.ok) {
    process.stderr.write(`[lint-0011] pg-meta HTTP ${res.status}: ${await res.text()}\n`);
    return null;
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return null;
  return rows.map((r) => r.fn).filter(Boolean);
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    process.stderr.write(`[lint-0011] allowlist ausente: ${ALLOWLIST_PATH}\n`);
    process.exit(2);
  }
  const doc = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  if (!Array.isArray(doc.functions)) {
    process.stderr.write(`[lint-0011] allowlist.functions inválida\n`);
    process.exit(2);
  }
  return { doc, set: new Set(doc.functions.map((e) => e.fn)) };
}

async function main() {
  let actual;
  if (fromFileArg) {
    const p = fromFileArg.slice('--from-file='.length);
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    actual = (Array.isArray(raw) ? raw : raw.functions || []).map((r) =>
      typeof r === 'string' ? r : r.fn,
    );
  } else {
    actual = await fetchLive();
    if (actual === null) {
      process.stderr.write('[lint-0011] sem credenciais pg-meta — skip (dev local).\n');
      process.exit(0);
    }
  }

  const { doc, set: allowed } = loadAllowlist();
  const actualSet = new Set(actual);

  const newFindings = actual.filter((fn) => !allowed.has(fn));
  const staleAllowlist = doc.functions.map((e) => e.fn).filter((fn) => !actualSet.has(fn));

  if (UPDATE) {
    const merged = new Map(doc.functions.map((e) => [e.fn, e]));
    for (const fn of newFindings) {
      merged.set(fn, { fn, reason: 'TODO: documentar motivo antes de aprovar PR' });
    }
    for (const fn of staleAllowlist) merged.delete(fn);
    const next = {
      ...doc,
      functions: Array.from(merged.values()).sort((a, b) => a.fn.localeCompare(b.fn)),
    };
    writeFileSync(ALLOWLIST_PATH, JSON.stringify(next, null, 2) + '\n');
    process.stderr.write(
      `[lint-0011] allowlist atualizada: +${newFindings.length} / -${staleAllowlist.length}\n`,
    );
    process.exit(0);
  }

  const missingReasons = doc.functions
    .filter((e) => !e.reason || !String(e.reason).trim())
    .map((e) => e.fn);

  const problems = [];
  if (newFindings.length) {
    problems.push(
      `❌ ${newFindings.length} finding(s) 0011 (search_path mutável) NÃO documentados:\n` +
        newFindings.map((fn) => `   - ${fn}`).join('\n'),
    );
  }
  if (missingReasons.length) {
    problems.push(
      `❌ ${missingReasons.length} entrada(s) na allowlist sem \`reason\`:\n` +
        missingReasons.map((fn) => `   - ${fn}`).join('\n'),
    );
  }

  if (staleAllowlist.length) {
    process.stderr.write(
      `⚠️  ${staleAllowlist.length} entrada(s) da allowlist não existem mais no DB:\n` +
        staleAllowlist.map((fn) => `   - ${fn}`).join('\n') +
        `\n   Rode: node scripts/check-lint-0011-drift.mjs --update-allowlist\n`,
    );
  }

  if (problems.length) {
    process.stderr.write('\n' + problems.join('\n\n') + '\n\n');
    process.stderr.write(
      "Correção padrão: adicione `SET search_path = public` (ou `= ''`) na função.\n" +
        'Exemplo:\n' +
        '  CREATE OR REPLACE FUNCTION public.minha_fn(...) RETURNS ...\n' +
        '  LANGUAGE plpgsql\n' +
        '  SECURITY DEFINER\n' +
        '  SET search_path = public   -- <-- obrigatório\n' +
        '  AS $$ ... $$;\n\n' +
        'Se a função precisa MESMO ficar sem search_path fixo (raro), adicione manualmente em\n' +
        '.security/lint-0011-allowlist.json com um `reason` real, OU rode\n' +
        '`node scripts/check-lint-0011-drift.mjs --update-allowlist` e edite o motivo antes do commit.\n',
    );
    process.exit(1);
  }

  process.stderr.write(
    `✅ lint 0011: ${actual.length} finding(s) — todos documentados na allowlist.\n`,
  );
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(`[lint-0011] erro: ${e.stack || e.message}\n`);
  process.exit(2);
});
