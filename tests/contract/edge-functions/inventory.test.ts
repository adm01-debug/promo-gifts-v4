/**
 * Inventory gate — força que TODA Edge Function tenha:
 *   (a) um schema canônico em `supabase/functions/_shared/contracts/<name>.contracts.ts`, ou
 *   (b) uma entrada na allowlist `tests/contract/_allowlist/no-contract.json`.
 *
 * Quando alguém adicionar uma função nova sem nenhum dos dois, este teste
 * falha — torna a decisão deliberada (criar contrato OU adicionar à allowlist
 * com justificativa em PR).
 *
 * Também garante:
 *   - a allowlist não contém funções inexistentes (lixo acumulado), e
 *   - nenhuma função aparece SIMULTANEAMENTE na allowlist e em contracts/
 *     (estado inconsistente).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const FUNCTIONS_DIR = join(REPO_ROOT, 'supabase', 'functions');
const CONTRACTS_DIR = join(FUNCTIONS_DIR, '_shared', 'contracts');
const ALLOWLIST_FILE = join(
  REPO_ROOT,
  'tests',
  'contract',
  '_allowlist',
  'no-contract.json',
);

const NON_FUNCTION_ENTRIES = new Set([
  '_shared',
  'tests',
  'cron',
  '.temp',
]);

function listEdgeFunctions(): string[] {
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => {
      if (NON_FUNCTION_ENTRIES.has(name)) return false;
      const full = join(FUNCTIONS_DIR, name);
      if (!statSync(full).isDirectory()) return false;
      return existsSync(join(full, 'index.ts'));
    })
    .sort();
}

function listContracts(): string[] {
  if (!existsSync(CONTRACTS_DIR)) return [];
  return readdirSync(CONTRACTS_DIR)
    .filter((f) => f.endsWith('.contracts.ts'))
    .map((f) => f.replace(/\.contracts\.ts$/, ''))
    .sort();
}

function loadAllowlist(): string[] {
  const raw = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf-8')) as {
    functions: string[];
  };
  return raw.functions.slice().sort();
}

describe('Edge Functions contract inventory', () => {
  const functions = listEdgeFunctions();
  const contracts = listContracts();
  const allowlist = loadAllowlist();

  it('cada Edge Function tem contrato OU está na allowlist', () => {
    const missing: string[] = [];
    for (const fn of functions) {
      const hasContract = contracts.includes(fn);
      const isAllowed = allowlist.includes(fn);
      if (!hasContract && !isAllowed) missing.push(fn);
    }
    expect(missing, `Funções sem contrato nem allowlist:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it('allowlist não referencia funções inexistentes (sem lixo)', () => {
    const ghosts = allowlist.filter((name) => !functions.includes(name));
    expect(ghosts, `Allowlist contém funções que não existem:\n  ${ghosts.join('\n  ')}`).toEqual([]);
  });

  it('nenhuma função está simultaneamente em contracts/ e na allowlist', () => {
    const conflicts = allowlist.filter((name) => contracts.includes(name));
    expect(
      conflicts,
      `Estado inconsistente: estas funções têm contrato mas estão também na allowlist (remova da allowlist):\n  ${conflicts.join('\n  ')}`,
    ).toEqual([]);
  });

  it('cada contrato em contracts/ corresponde a uma Edge Function existente', () => {
    const orphans = contracts.filter((name) => !functions.includes(name));
    expect(
      orphans,
      `Contratos órfãos (sem função em supabase/functions/<name>/):\n  ${orphans.join('\n  ')}`,
    ).toEqual([]);
  });
});
