/**
 * Fuzz/simulação exaustiva do gate `check-summary-color-tokens.mjs`.
 *
 * Estratégia:
 *  1. Confirma que o source atual PASSA no gate.
 *  2. Gera centenas de mutações sintéticas do bloco "Resumo das
 *     Configurações" e roda o gate sobre cada uma via arquivo temporário
 *     (drop-in via env var SUMMARY_GATE_FILES) — garante que toda
 *     regressão para primary/accent é detectada.
 *  3. Confirma que mutações neutras (texto, espaçamento, comentários)
 *     continuam passando ⇒ zero falso-positivo.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(__dirname, '../../../..');
const SCRIPT = resolve(ROOT, 'scripts/check-summary-color-tokens.mjs');
const REAL_FILE = resolve(ROOT, 'src/components/products/ProductCustomizationOptions.tsx');

/** Roda o gate contra uma lista de paths absolutos via env var. */
function runGate(files: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('node', [SCRIPT], {
      env: { ...process.env, SUMMARY_GATE_FILES: files.join(',') },
      encoding: 'utf8',
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      code: err.status ?? 1,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? ''),
    };
  }
}

let baseSource: string;
let workDir: string;

beforeAll(() => {
  baseSource = readFileSync(REAL_FILE, 'utf8');
  workDir = mkdtempSync(join(tmpdir(), 'summary-gate-'));
  // O gate procura arquivos sob ROOT; usamos um subdir replicando o caminho
  mkdirSync(join(workDir, 'src/components/products'), { recursive: true });
});

function write(name: string, contents: string): string {
  const p = join(workDir, 'src/components/products', name);
  writeFileSync(p, contents);
  return p;
}

describe('Gate summary-color-tokens — fuzz exaustivo', () => {
  it('passa no source real (baseline)', () => {
    const r = runGate([REAL_FILE]);
    expect(r.code, r.stderr || r.stdout).toBe(0);
    expect(r.stdout).toMatch(/Tokens "success" preservados/);
  });

  // Matriz de tokens proibidos individuais
  const FORBIDDEN_REPLACEMENTS: Array<[from: RegExp, to: string, label: string]> = [
    [/\bbg-success\b/, 'bg-primary', 'bullet → primary'],
    [/\bbg-success\b/, 'bg-accent', 'bullet → accent'],
    [/\bborder-success\/20\b/, 'border-primary/10', 'borda card → primary'],
    [/\bborder-success\/20\b/, 'border-accent/30', 'borda card → accent'],
    [/\bbg-success\/5\b/, 'bg-primary/5', 'bg card → primary'],
    [/\bbg-success\/5\b/, 'bg-accent/10', 'bg card → accent'],
    [/\btext-success\b/, 'text-primary', 'label → primary'],
    [/\btext-success\b/, 'text-accent-foreground', 'label → accent'],
  ];

  it.each(FORBIDDEN_REPLACEMENTS)(
    'detecta mutação proibida: %s',
    (_re, _to, label) => {
      const re = _re as RegExp;
      const mutated = baseSource.replace(re, _to);
      expect(mutated, `mutação "${label}" não alterou o source`).not.toBe(baseSource);
      const p = write(`mut-${label.replace(/\W+/g, '_')}.tsx`, mutated);
      const r = runGate([p]);
      expect(r.code, `gate deveria falhar para ${label}\nstdout:${r.stdout}`).not.toBe(0);
    },
  );

  it('detecta remoção COMPLETA de tokens success (todos viram primary)', () => {
    const mutated = baseSource
      .replace(/bg-success\b/g, 'bg-primary')
      .replace(/border-success\/(\d+)/g, 'border-primary/$1')
      .replace(/bg-success\/(\d+)/g, 'bg-primary/$1')
      .replace(/text-success\b/g, 'text-primary');
    const p = write('mut-all-primary.tsx', mutated);
    const r = runGate([p]);
    expect(r.code).not.toBe(0);
    expect(r.stdout + r.stderr).toMatch(/border-primary|bg-primary|text-primary/);
  });

  it('detecta remoção do título canônico', () => {
    const mutated = baseSource.replace(
      'Resumo das Configurações',
      'Resumo da Personalização',
    );
    const p = write('mut-titulo.tsx', mutated);
    const r = runGate([p]);
    expect(r.code).not.toBe(0);
    expect(r.stdout + r.stderr).toMatch(/título.*não encontrado/i);
  });

  it('detecta arquivo inexistente', () => {
    const r = runGate([resolve(workDir, 'src/components/products/nao-existe.tsx')]);
    expect(r.code).not.toBe(0);
    expect(r.stdout + r.stderr).toMatch(/arquivo ausente/);
  });

  // Mutações NEUTRAS — não devem disparar o gate
  const NEUTRAL_MUTATIONS: Array<[label: string, fn: (s: string) => string]> = [
    ['adiciona comentário', (s) => s.replace('Resumo das Configurações', '/* ok */ Resumo das Configurações')],
    ['troca aspas simples por duplas em strings JS', (s) => s.replace(/'pt-BR'/, '"pt-BR"')],
    ['adiciona whitespace extra', (s) => s.replace(/border border-success\/20/, 'border  border-success/20')],
    ['adiciona className extra inócuo', (s) => s.replace('bg-success/5 p-2.5', 'bg-success/5 p-2.5 transition-colors')],
    ['troca aspas no JSX className', (s) => s.replace('className="mt-6 border-t border-border/60', "className='mt-6 border-t border-border/60")],
  ];

  it.each(NEUTRAL_MUTATIONS)('mutação neutra "%s" continua passando', (label, fn) => {
    const mutated = fn(baseSource);
    expect(mutated, `mutação "${label}" não alterou o source`).not.toBe(baseSource);
    const p = write(`neutral-${label.replace(/\W+/g, '_')}.tsx`, mutated);
    const r = runGate([p]);
    expect(r.code, `falso-positivo em "${label}"\nstdout:${r.stdout}\nstderr:${r.stderr}`).toBe(0);
  });

  // Fuzz: 200 mutações aleatórias trocando tokens success por proibidos
  // em posições arbitrárias — gate deve falhar em 100% delas.
  it('fuzz 200x: qualquer troca success→primary/accent é detectada', () => {
    const positions: number[] = [];
    const re = /\b(bg-success|border-success\/\d+|bg-success\/\d+|text-success)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(baseSource)) !== null) positions.push(m.index);

    expect(positions.length).toBeGreaterThan(3);

    const forbiddenPool = [
      'bg-primary',
      'bg-accent',
      'border-primary/10',
      'border-accent/30',
      'bg-primary/5',
      'bg-accent/10',
      'text-primary',
      'text-accent-foreground',
    ];

    let detected = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const pos = positions[i % positions.length];
      const tail = baseSource.slice(pos);
      const tokenMatch = /^(bg-success\/\d+|border-success\/\d+|bg-success|text-success)/.exec(tail);
      if (!tokenMatch) continue;
      const original = tokenMatch[0];
      const replacement = forbiddenPool[(i * 7) % forbiddenPool.length];
      const mutated =
        baseSource.slice(0, pos) + replacement + baseSource.slice(pos + original.length);
      const p = write(`fuzz-${i}.tsx`, mutated);
      const r = runGate([p]);
      if (r.code !== 0) detected++;
    }
    expect(detected).toBe(N);
  });
});
