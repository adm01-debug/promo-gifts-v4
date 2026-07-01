/**
 * scripts/__tests__/promote-draft-migration.test.ts
 *
 * Testes unitários das funções puras de `scripts/promote-draft-migration.mjs`:
 *   - parseHandleList (csv/whitespace)
 *   - parsePositiveInt (default, NaN em inválido)
 *   - validateHandles (formato GitHub + duplicatas)
 *   - GH_HANDLE_RE (aceita user, org/team, foo[bot])
 *
 * Também há um teste de integração leve via spawnSync que confirma que
 * `--reviewers` inválido **aborta ANTES** de criar branch/commit/PR
 * (i.e. o processo sai com código 1 sem tocar o git).
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-expect-error — módulo .mjs sem tipos, mas exporta helpers puros
import {
  parseHandleList,
  parsePositiveInt,
  validateHandles,
  GH_HANDLE_RE,
} from '../promote-draft-migration.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'promote-draft-migration.mjs');

describe('parseHandleList', () => {
  it('retorna [] para vazio/undefined/null', () => {
    expect(parseHandleList(undefined)).toEqual([]);
    expect(parseHandleList(null)).toEqual([]);
    expect(parseHandleList('')).toEqual([]);
    expect(parseHandleList('   ')).toEqual([]);
  });

  it('aceita separador vírgula', () => {
    expect(parseHandleList('alice,bob,carla')).toEqual(['alice', 'bob', 'carla']);
  });

  it('aceita separador espaço', () => {
    expect(parseHandleList('alice bob carla')).toEqual(['alice', 'bob', 'carla']);
  });

  it('aceita mix de vírgula + espaço + tabs', () => {
    expect(parseHandleList('alice, bob\tcarla,  david ')).toEqual(['alice', 'bob', 'carla', 'david']);
  });

  it('não deduplica (validateHandles é quem faz)', () => {
    expect(parseHandleList('alice,alice,bob')).toEqual(['alice', 'alice', 'bob']);
  });
});

describe('parsePositiveInt', () => {
  it('retorna default se vazio/null/undefined', () => {
    expect(parsePositiveInt(undefined, 60_000)).toBe(60_000);
    expect(parsePositiveInt(null, 60_000)).toBe(60_000);
    expect(parsePositiveInt('', 60_000)).toBe(60_000);
  });

  it('parseia inteiros positivos', () => {
    expect(parsePositiveInt('120000', 60_000)).toBe(120_000);
    expect(parsePositiveInt('1', 60_000)).toBe(1);
  });

  it('trunca decimais', () => {
    expect(parsePositiveInt('120000.7', 60_000)).toBe(120_000);
  });

  it('retorna NaN para valores inválidos', () => {
    expect(Number.isNaN(parsePositiveInt('abc', 60_000))).toBe(true);
    expect(Number.isNaN(parsePositiveInt('-1', 60_000))).toBe(true);
    expect(Number.isNaN(parsePositiveInt('0', 60_000))).toBe(true);
  });
});

describe('GH_HANDLE_RE', () => {
  it.each([
    ['alice', true],
    ['bob-2', true],
    ['a', true],
    ['A1B2', true],
    ['org/time-db', true],
    ['org/time.name_2', true],
    ['dependabot[bot]', true],
    ['renovate[bot]', true],
  ])('aceita handle válido "%s"', (h, expected) => {
    expect(GH_HANDLE_RE.test(h)).toBe(expected);
  });

  it.each([
    ['@alice', false],       // "@" não é permitido
    ['ali ce', false],       // espaço interno
    ['ali!ce', false],       // caractere especial
    ['-alice', false],       // começa com hífen
    ['', false],
    ['alice/', false],       // team incompleto
    ['/team', false],        // org faltando
    ['a'.repeat(40), false], // > 39 chars (limite GitHub)
  ])('rejeita handle inválido "%s"', (h, expected) => {
    expect(GH_HANDLE_RE.test(h)).toBe(expected);
  });
});

describe('validateHandles', () => {
  it('retorna null para lista vazia', () => {
    expect(validateHandles('reviewers', [])).toBeNull();
  });

  it('retorna null para lista válida', () => {
    expect(validateHandles('reviewers', ['alice', 'bob', 'org/time'])).toBeNull();
  });

  it('reporta handles inválidos com nome da flag', () => {
    const msg = validateHandles('assignees', ['alice', '@bad']);
    expect(msg).toContain('--assignees inválido');
    expect(msg).toContain('"@bad"');
  });

  it('reporta múltiplos inválidos de uma vez', () => {
    const msg = validateHandles('reviewers', ['alice', '@bad', 'a b']);
    expect(msg).toContain('"@bad"');
    expect(msg).toContain('"a b"');
  });

  it('detecta duplicatas', () => {
    const msg = validateHandles('reviewers', ['alice', 'bob', 'alice']);
    expect(msg).toContain('duplicadas');
    expect(msg).toContain('alice');
  });

  it('prioriza reportar inválido antes de duplicata', () => {
    const msg = validateHandles('reviewers', ['@bad', '@bad']);
    expect(msg).toContain('inválido');
    // não é "duplicadas" — inválido pega primeiro
    expect(msg).not.toContain('duplicadas');
  });
});

// ---------------------------------------------------------------------------
// Integração leve: garante que `--reviewers` inválido aborta antes do git.
// ---------------------------------------------------------------------------
describe('CLI: --reviewers/--assignees abortam antes de commit/PR', () => {
  const REAL_DRAFT = '2026-06-27_quotes_status_allow_cancelled.sql';

  function run(args: string[]) {
    return spawnSync('node', [SCRIPT, REAL_DRAFT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      cwd: resolve(__dirname, '..', '..'),
    });
  }

  it('sai com código 1 e mensagem clara para --reviewers inválido', () => {
    const r = run(['--apply', '--pr', '--reviewers=alice,@bad']);
    expect(r.status).toBe(1);
    const out = (r.stdout + r.stderr);
    expect(out).toMatch(/--reviewers inválido/);
    expect(out).toMatch(/"@bad"/);
    // nunca deve ter chegado a criar branch/commit
    expect(out).not.toMatch(/Branch criada/);
    expect(out).not.toMatch(/Commit criado/);
  });

  it('sai com código 1 para --assignees inválido', () => {
    const r = run(['--apply', '--pr', '--assignees=@fulano']);
    expect(r.status).toBe(1);
    const out = (r.stdout + r.stderr);
    expect(out).toMatch(/--assignees inválido/);
    expect(out).not.toMatch(/Branch criada/);
  });

  it('sai com código 1 para --db-diff-max-bytes inválido', () => {
    const r = run(['--apply', '--pr', '--db-diff-max-bytes=abc']);
    expect(r.status).toBe(1);
    const out = (r.stdout + r.stderr);
    expect(out).toMatch(/--db-diff-max-bytes/);
    expect(out).not.toMatch(/Branch criada/);
  });
});
