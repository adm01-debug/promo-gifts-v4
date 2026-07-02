/**
 * Contrato do spec E2E do card "Condições" — validado sem executar Playwright.
 * Garante que o hardening (networkidle, fonts.ready, animations, caret, scale,
 * tolerâncias de bounding box) permanece no arquivo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SPEC = readFileSync(
  resolve(__dirname, '../../e2e/ui/quote-conditions-visual.spec.ts'),
  'utf8',
);

describe('e2e/ui/quote-conditions-visual.spec.ts — contrato', () => {
  it('cobre os 3 viewports 375/768/1280', () => {
    expect(SPEC).toMatch(/width:\s*375/);
    expect(SPEC).toMatch(/width:\s*768/);
    expect(SPEC).toMatch(/width:\s*1280/);
  });

  it('aguarda networkidle e fontes prontas', () => {
    expect(SPEC).toMatch(/waitForLoadState\(['"]networkidle['"]\)/);
    expect(SPEC).toMatch(/document\s*(?:as\s*any)?\)?\.?fonts\??\.ready/);
  });

  it('desativa animações/transições/caret via addStyleTag', () => {
    expect(SPEC).toMatch(/addStyleTag/);
    expect(SPEC).toMatch(/animation:\s*none/);
    expect(SPEC).toMatch(/transition:\s*none/);
    expect(SPEC).toMatch(/caret-color:\s*transparent/);
  });

  it('toHaveScreenshot usa animations disabled + caret hide + scale css + maxDiffPixelRatio', () => {
    expect(SPEC).toMatch(/toHaveScreenshot\([^)]*quote-conditions-/);
    expect(SPEC).toMatch(/animations:\s*['"]disabled['"]/);
    expect(SPEC).toMatch(/caret:\s*['"]hide['"]/);
    expect(SPEC).toMatch(/scale:\s*['"]css['"]/);
    expect(SPEC).toMatch(/maxDiffPixelRatio:\s*0\.02/);
  });

  it('tolerâncias de bounding box ≤ 4px', () => {
    const tolerances = [...SPEC.matchAll(/toBeLessThan(?:OrEqual)?\((\d+)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(tolerances.length).toBeGreaterThan(0);
    for (const t of tolerances) expect(t).toBeLessThanOrEqual(4);
  });

  it('ordem de foco Validade → Forma → Prazo preservada', () => {
    const idxValidity = SPEC.indexOf('validity.focus');
    const idxMethod = SPEC.indexOf('method).toBeFocused');
    const idxTerms = SPEC.indexOf('terms).toBeFocused');
    expect(idxValidity).toBeGreaterThan(0);
    expect(idxMethod).toBeGreaterThan(idxValidity);
    expect(idxTerms).toBeGreaterThan(idxMethod);
  });
});
