/**
 * scripts/__tests__/check-eslint-config-current.test.ts
 *
 * Testes do script `scripts/check-eslint-config-current.mjs` (T-FIX-5
 * follow-up). Garante que o detector de configs *.proposed.* órfãos
 * continua funcionando corretamente conforme o repo evolui.
 *
 * Estratégia:
 *   - Cada teste cria um diretório temporário isolado (mkdtempSync) e
 *     roda o script com `cwd: tmpDir` via spawnSync. Isso evita
 *     contaminação entre testes e não toca o repo real.
 *   - Casos positivos (deve detectar) e negativos (NÃO deve detectar)
 *     são organizados via `it.each` — propositalmente usamos o padrão
 *     idiomático que o T-FIX-5 lint guard-rail está protegendo.
 *
 * Refs: T-FIX-5 (commits c129d54, 57d9f8f, c033e71).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, '..', 'check-eslint-config-current.mjs');

describe('scripts/check-eslint-config-current.mjs', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'check-eslint-config-current-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * Invoca o script via Node em um sandbox (cwd = tmpDir).
   * Retorna o objeto SpawnSyncReturns para inspeção (status, stdout, stderr).
   */
  function runScript(args: string[] = []): SpawnSyncReturns<string> {
    return spawnSync('node', [SCRIPT_PATH, ...args], {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // SMOKE
  // ─────────────────────────────────────────────────────────────────
  describe('smoke', () => {
    it('script file exists at scripts/check-eslint-config-current.mjs', () => {
      expect(existsSync(SCRIPT_PATH)).toBe(true);
    });

    it('script executes without crashing on an empty directory', () => {
      const result = runScript();
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // HAPPY PATH — sem orphans
  // ─────────────────────────────────────────────────────────────────
  describe('happy path (no orphans)', () => {
    it('exits 0 with success message when directory has no proposed configs', () => {
      const result = runScript();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('no orphaned');
    });

    it('exits 0 even with --strict when there are no orphans', () => {
      const result = runScript(['--strict']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('no orphaned');
    });

    it('does NOT consider eslint.config.js (without .proposed.) as an orphan', () => {
      writeFileSync(join(tmpDir, 'eslint.config.js'), '// dummy config\n');
      const result = runScript();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('no orphaned');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // ORPHAN DETECTION — detecta com warn ou error
  // ─────────────────────────────────────────────────────────────────
  describe('orphan detection', () => {
    beforeEach(() => {
      // Cenário típico do T-FIX-5: arquivo proposed pendente de mv
      writeFileSync(
        join(tmpDir, 'eslint.config.t-fix-5.proposed.js'),
        '// orphan proposed config\n'
      );
    });

    it('detects orphan with warning level by default (exit 0)', () => {
      const result = runScript();
      expect(result.status).toBe(0);
      const output = result.stdout + result.stderr;
      expect(output).toContain('orphaned proposed config');
      expect(output).toContain('eslint.config.t-fix-5.proposed.js');
    });

    it('exits 1 with --strict when an orphan is found', () => {
      const result = runScript(['--strict']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('eslint.config.t-fix-5.proposed.js');
    });

    it('prints actionable cleanup instructions (mv and git rm)', () => {
      const result = runScript();
      const output = result.stdout + result.stderr;
      expect(output).toContain('mv ');
      expect(output).toContain('git rm');
    });

    it('lists multiple orphans sorted alphabetically', () => {
      writeFileSync(join(tmpDir, 'a-zebra.proposed.js'), '// orphan\n');
      writeFileSync(join(tmpDir, 'a-alpha.proposed.ts'), '// orphan\n');

      const result = runScript(['--strict']);
      expect(result.status).toBe(1);

      const output = result.stderr;
      const alphaIdx = output.indexOf('a-alpha.proposed.ts');
      const zebraIdx = output.indexOf('a-zebra.proposed.js');
      const eslintIdx = output.indexOf('eslint.config.t-fix-5.proposed.js');

      expect(alphaIdx).toBeGreaterThan(-1);
      expect(zebraIdx).toBeGreaterThan(-1);
      expect(eslintIdx).toBeGreaterThan(-1);

      // Ordem lexicográfica: a-alpha < a-zebra < eslint.config
      expect(alphaIdx).toBeLessThan(zebraIdx);
      expect(zebraIdx).toBeLessThan(eslintIdx);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // EDGE CASES — extensões fora da whitelist e padrões case-sensitive
  //
  // Note: estamos usando it.each propositalmente — o padrão
  // idiomático que o T-FIX-5 lint guard-rail está protegendo.
  // Se alguém futuramente refatorar para forEach + it, o lint do
  // próprio repo vai bloquear o PR. Recursão poética.
  // ─────────────────────────────────────────────────────────────────
  describe('edge cases / extension whitelist', () => {
    const NEGATIVE_CASES: Array<[string, string]> = [
      ['foo.proposed.md', 'markdown não está na whitelist'],
      ['foo.proposed.txt', 'texto puro não está na whitelist'],
      ['foo.proposed.yaml', 'yaml não está na whitelist'],
      ['foo.proposed.yml', 'yml não está na whitelist'],
      ['proposed.js', 'sem nome prefixando .proposed.'],
      ['something.PROPOSED.js', 'extensão uppercase (regex case-sensitive)'],
      ['.proposed.js', 'só ponto antes de .proposed.'],
    ];

    it.each(NEGATIVE_CASES)(
      'does NOT flag %s as orphan (%s)',
      (filename, _reason) => {
        writeFileSync(join(tmpDir, filename), '// not an orphan\n');
        const result = runScript();
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('no orphaned');
      }
    );

    const POSITIVE_CASES: Array<[string, string]> = [
      ['foo.proposed.js', 'extensão js'],
      ['foo.proposed.mjs', 'extensão mjs'],
      ['foo.proposed.cjs', 'extensão cjs'],
      ['foo.proposed.ts', 'extensão ts'],
      ['foo.proposed.tsx', 'extensão tsx'],
      ['foo.proposed.json', 'extensão json'],
      ['foo.proposed.mts', 'extensão mts'],
      ['foo.proposed.cts', 'extensão cts'],
    ];

    it.each(POSITIVE_CASES)(
      'flags %s as orphan (%s)',
      (filename, _reason) => {
        writeFileSync(join(tmpDir, filename), '// orphan\n');
        const result = runScript(['--strict']);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(filename);
      }
    );
  });
});
