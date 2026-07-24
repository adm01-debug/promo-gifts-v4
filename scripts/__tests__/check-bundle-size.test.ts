/**
 * scripts/__tests__/check-bundle-size.test.ts
 *
 * Testes do gate de tamanho de bundle em `scripts/check-bundle-size.mjs`.
 *
 * Cobertura:
 *   - Passa quando todos os chunks estão dentro dos limites.
 *   - Falha por limite global por-chunk.
 *   - Falha por limite total.
 *   - Falha por chunk crítico acima do próprio teto.
 *   - Falha por regressão >regressionThresholdPct vs snapshot.
 *   - Bate o prefixo do chunk removendo o hash Vite corretamente.
 *   - Modo --update-baseline gera snapshot + preserva criticalChunks.
 *
 * Estratégia: monta um dist/assets/ fake e um bundle-size-baseline.json
 * em diretórios temporários isolados, roda o script via spawnSync.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, '..', 'check-bundle-size.mjs');

interface BaselineOverrides {
  limits?: Partial<{
    maxChunkBytes: number;
    maxTotalBytes: number;
    warningThresholdPct: number;
    regressionThresholdPct: number;
  }>;
  criticalChunks?: Record<string, { maxBytes: number; label: string }>;
  snapshot?: { chunksByPrefix: Record<string, number> } | null;
}

function writeBaseline(dir: string, overrides: BaselineOverrides = {}): void {
  const baseline = {
    generatedAt: new Date().toISOString(),
    limits: {
      maxChunkBytes: 2_000_000,
      maxTotalBytes: 12_000_000,
      warningThresholdPct: 75,
      regressionThresholdPct: 15,
      ...overrides.limits,
    },
    criticalChunks: overrides.criticalChunks ?? {
      'react-vendor': { maxBytes: 350_000, label: 'React + ReactDOM' },
    },
    snapshot: overrides.snapshot ?? null,
  };
  writeFileSync(join(dir, 'bundle-size-baseline.json'), JSON.stringify(baseline, null, 2));
}

function writeChunk(dir: string, filename: string, sizeBytes: number): void {
  const assetsDir = join(dir, 'dist', 'assets');
  mkdirSync(assetsDir, { recursive: true });
  // Buffer.alloc é O(1) para bytes zerados — perfeito para simular tamanho.
  writeFileSync(join(assetsDir, filename), Buffer.alloc(sizeBytes));
}

function runGate(cwd: string, args: string[] = []) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

describe('scripts/check-bundle-size.mjs', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'bundle-gate-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sai 0 quando todos os chunks estão dentro dos limites', () => {
    writeBaseline(tmpDir);
    writeChunk(tmpDir, 'react-vendor-Abc12345.js', 200_000);
    writeChunk(tmpDir, 'index-Xyz67890.js', 300_000);

    const result = runGate(tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('dentro dos limites');
  });

  it('falha quando um chunk ultrapassa o limite global por-chunk', () => {
    writeBaseline(tmpDir, { limits: { maxChunkBytes: 500_000 } });
    writeChunk(tmpDir, 'huge-chunk-Abc12345.js', 800_000);

    const result = runGate(tmpDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[global]');
    expect(result.stderr).toContain('huge-chunk');
  });

  it('falha quando o total ultrapassa o limite agregado', () => {
    writeBaseline(tmpDir, { limits: { maxTotalBytes: 300_000 } });
    writeChunk(tmpDir, 'a-Abc12345.js', 200_000);
    writeChunk(tmpDir, 'b-Def67890.js', 200_000);

    const result = runGate(tmpDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[total]');
  });

  it('falha quando um chunk crítico específico excede o próprio teto', () => {
    writeBaseline(tmpDir, {
      criticalChunks: {
        'react-vendor': { maxBytes: 100_000, label: 'React' },
      },
    });
    writeChunk(tmpDir, 'react-vendor-Abc12345.js', 200_000);

    const result = runGate(tmpDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[critical]');
    expect(result.stderr).toContain('react-vendor');
  });

  it('falha quando um chunk crítico cresce acima do regressionThresholdPct', () => {
    writeBaseline(tmpDir, {
      limits: { regressionThresholdPct: 15 },
      criticalChunks: {
        'react-vendor': { maxBytes: 1_000_000, label: 'React' },
      },
      snapshot: { chunksByPrefix: { 'react-vendor': 100_000 } },
    });
    // 100k → 130k = +30% (> 15% limite)
    writeChunk(tmpDir, 'react-vendor-Abc12345.js', 130_000);

    const result = runGate(tmpDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[regression]');
    expect(result.stderr).toContain('30.0%');
  });

  it('passa quando crescimento está abaixo do regressionThresholdPct', () => {
    writeBaseline(tmpDir, {
      limits: { regressionThresholdPct: 15 },
      criticalChunks: {
        'react-vendor': { maxBytes: 1_000_000, label: 'React' },
      },
      snapshot: { chunksByPrefix: { 'react-vendor': 100_000 } },
    });
    // 100k → 105k = +5% (< 15%)
    writeChunk(tmpDir, 'react-vendor-Abc12345.js', 105_000);

    const result = runGate(tmpDir);
    expect(result.status).toBe(0);
  });

  it('extrai o prefixo do chunk removendo apenas o hash Vite final', () => {
    // Nomes com múltiplos hífens devem manter tudo até o último hash.
    writeBaseline(tmpDir, {
      criticalChunks: {
        'react-vendor': { maxBytes: 100_000, label: 'React' },
      },
    });
    writeChunk(tmpDir, 'react-vendor-CxYz1234.js', 200_000);

    const result = runGate(tmpDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('react-vendor');
  });

  it('modo --update-baseline gera snapshot preservando criticalChunks', () => {
    writeBaseline(tmpDir, {
      criticalChunks: {
        'react-vendor': { maxBytes: 100_000, label: 'React + ReactDOM' },
        'ui-vendor': { maxBytes: 500_000, label: 'Radix UI' },
      },
    });
    writeChunk(tmpDir, 'react-vendor-Abc12345.js', 150_000);
    writeChunk(tmpDir, 'ui-vendor-Def67890.js', 300_000);

    const result = runGate(tmpDir, ['--update-baseline']);
    expect(result.status).toBe(0);

    const updated = JSON.parse(
      readFileSync(join(tmpDir, 'bundle-size-baseline.json'), 'utf8'),
    );
    expect(updated.snapshot).toBeDefined();
    expect(updated.snapshot.chunksByPrefix['react-vendor']).toBe(150_000);
    expect(updated.snapshot.chunksByPrefix['ui-vendor']).toBe(300_000);
    // Labels preservados
    expect(updated.criticalChunks['react-vendor'].label).toBe('React + ReactDOM');
    expect(updated.criticalChunks['ui-vendor'].label).toBe('Radix UI');
    // Limites atualizados com +20% de margem
    expect(updated.criticalChunks['react-vendor'].maxBytes).toBe(Math.ceil(150_000 * 1.2));
  });

  it('não falha quando chunk crítico está ausente do build (apenas info)', () => {
    writeBaseline(tmpDir, {
      criticalChunks: {
        'missing-vendor': { maxBytes: 100_000, label: 'Missing' },
      },
    });
    writeChunk(tmpDir, 'index-Abc12345.js', 50_000);

    const result = runGate(tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('não encontrado no build');
  });
});
