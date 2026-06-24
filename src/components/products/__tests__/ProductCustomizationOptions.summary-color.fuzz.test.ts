/**
 * Fuzz/simulação exaustiva do gate `check-summary-color-tokens.mjs`.
 * Roda `auditSource` in-process (zero spawns de Node) ⇒ 500+ mutações
 * em milissegundos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — .mjs ESM sem types
import { auditSource, auditFile } from '../../../../scripts/check-summary-color-tokens.mjs';

const REAL_FILE = resolve(
  __dirname,
  '../../../../src/components/products/ProductCustomizationOptions.tsx',
);
const baseSource: string = readFileSync(REAL_FILE, 'utf8');

const audit = (src: string): string[] => (auditSource as (s: string, l?: string) => string[])(src);

describe('Gate summary-color-tokens — fuzz exaustivo', () => {
  it('source real passa no gate (baseline)', () => {
    expect(audit(baseSource)).toEqual([]);
    expect(
      (auditFile as (rel: string) => string[])('src/components/products/ProductCustomizationOptions.tsx'),
    ).toEqual([]);
  });

  // Matriz de substituições proibidas (cobre primary, accent, com e sem opacidade)
  const FORBIDDEN_REPLACEMENTS: Array<[from: RegExp, to: string, label: string]> = [
    [/\bbg-success\b/, 'bg-primary', 'bullet → bg-primary puro'],
    [/\bbg-success\b/, 'bg-accent', 'bullet → bg-accent puro'],
    [/\bborder-success\/20\b/, 'border-primary/10', 'borda → border-primary/10'],
    [/\bborder-success\/20\b/, 'border-accent/30', 'borda → border-accent/30'],
    [/\bborder-success\/20\b/, 'border-primary', 'borda → border-primary puro'],
    [/\bborder-success\/20\b/, 'border-accent', 'borda → border-accent puro'],
    [/\bbg-success\/5\b/, 'bg-primary/5', 'bg card → bg-primary/5'],
    [/\bbg-success\/5\b/, 'bg-accent/10', 'bg card → bg-accent/10'],
    [/\bbg-success\/5\b/, 'bg-primary', 'bg card → bg-primary puro'],
    [/\btext-success\b/, 'text-primary', 'label → text-primary'],
    [/\btext-success\b/, 'text-primary-foreground', 'label → text-primary-foreground'],
    [/\btext-success\b/, 'text-accent', 'label → text-accent'],
    [/\btext-success\b/, 'text-accent-foreground', 'label → text-accent-foreground'],
  ];

  it.each(FORBIDDEN_REPLACEMENTS)('detecta: %s → %s (%s)', (re, to, label) => {
    const mutated = baseSource.replace(re as RegExp, to);
    expect(mutated, `regex não casou: ${label}`).not.toBe(baseSource);
    const errs = audit(mutated);
    expect(errs.length, `gate não detectou ${label}\n${errs.join('\n')}`).toBeGreaterThan(0);
    expect(errs.some((e) => /proibido/.test(e))).toBe(true);
  });

  it('detecta mutação "all-primary" (substituição em massa)', () => {
    const mutated = baseSource
      .replace(/\bbg-success\b/g, 'bg-primary')
      .replace(/\bborder-success\/(\d+)/g, 'border-primary/$1')
      .replace(/\bbg-success\/(\d+)/g, 'bg-primary/$1')
      .replace(/\btext-success\b/g, 'text-primary');
    const errs = audit(mutated);
    expect(errs.length).toBeGreaterThanOrEqual(4);
  });

  it('detecta título renomeado', () => {
    const errs = audit(baseSource.replace('Resumo das Configurações', 'Resumo XYZ'));
    expect(errs.some((e) => /não encontrado/.test(e))).toBe(true);
  });

  it('detecta arquivo inexistente', () => {
    const errs = (auditFile as (rel: string) => string[])('src/_nao_existe_.tsx');
    expect(errs.some((e) => /ausente/.test(e))).toBe(true);
  });

  // Mutações neutras — ZERO falsos-positivos
  const NEUTRAL: Array<[label: string, fn: (s: string) => string]> = [
    ['comentário inline', (s) => s.replace('Resumo das Configurações', '/* x */ Resumo das Configurações')],
    ['aspas JS', (s) => s.replace(/'pt-BR'/, '"pt-BR"')],
    ['whitespace extra', (s) => s.replace(/border border-success\/20/, 'border  border-success/20')],
    ['classe inócua extra', (s) => s.replace('bg-success/5 p-2.5', 'bg-success/5 p-2.5 transition-colors')],
    ['aspas JSX', (s) => s.replace('className="mt-6 border-t border-border/60', "className='mt-6 border-t border-border/60")],
    ['quebra de linha extra', (s) => s.replace('Resumo das Configurações', 'Resumo das Configurações\n')],
    ['emoji no título do JSX', (s) => s.replace('Resumo das Configurações', 'Resumo das Configurações ✨')],
  ];

  it.each(NEUTRAL)('neutra "%s" não dispara falso-positivo', (label, fn) => {
    const mutated = fn(baseSource);
    expect(mutated).not.toBe(baseSource);
    const errs = audit(mutated);
    expect(errs, `falso-positivo em "${label}":\n${errs.join('\n')}`).toEqual([]);
  });

  it('fuzz 500x: qualquer troca success→proibido é detectada (sem flaky)', () => {
    const tokenRe = /\b(border-success\/\d+|bg-success\/\d+|bg-success|text-success)\b/g;
    const positions: Array<{ pos: number; len: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(baseSource)) !== null) {
      positions.push({ pos: m.index, len: m[0].length });
    }
    expect(positions.length).toBeGreaterThan(3);

    const pool = [
      'bg-primary',
      'bg-accent',
      'border-primary/10',
      'border-accent/30',
      'border-primary',
      'border-accent',
      'bg-primary/5',
      'bg-accent/10',
      'text-primary',
      'text-accent',
      'text-primary-foreground',
      'text-accent-foreground',
    ];

    const N = 500;
    let detected = 0;
    for (let i = 0; i < N; i++) {
      const { pos, len } = positions[i % positions.length];
      const replacement = pool[(i * 7 + 3) % pool.length];
      const mutated = baseSource.slice(0, pos) + replacement + baseSource.slice(pos + len);
      const errs = audit(mutated);
      if (errs.length > 0) detected++;
    }
    expect(detected).toBe(N);
  });
});
