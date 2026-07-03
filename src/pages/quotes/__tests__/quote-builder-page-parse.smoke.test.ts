/**
 * @vitest-environment node
 *
 * Smoke: garante que QuoteBuilderPage.tsx compila (parseia via esbuild).
 * Objetivo: detectar erros como "Unexpected token" ANTES do build de deploy.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transformSync } from 'esbuild';

const SRC_PATH = resolve(__dirname, '../QuoteBuilderPage.tsx');
const SRC = readFileSync(SRC_PATH, 'utf8');

describe('QuoteBuilderPage — parse smoke', () => {
  it('esbuild consegue transformar o arquivo sem erros de sintaxe', () => {
    expect(() =>
      transformSync(SRC, {
        loader: 'tsx',
        jsx: 'automatic',
        sourcefile: 'QuoteBuilderPage.tsx',
      }),
    ).not.toThrow();
  });

  it('bloco Frete: grid responsivo (grid-cols-1 md:grid-cols-3) presente para não quebrar layout em nenhuma largura', () => {
    // Mobile: grid-cols-1 (empilha) | md+: md:grid-cols-3 (linha)
    expect(SRC).toMatch(
      /grid grid-cols-1 md:grid-cols-3 gap-3 items-end[^"]*"[\s\S]{0,400}shipping-type-select-root/,
    );
  });

  it('bloco Frete: trigger e input Valor R$ compartilham o mesmo grid (sem largura full-width isolada)', () => {
    const idx = SRC.indexOf('shipping-type-select-root');
    expect(idx).toBeGreaterThan(0);
    const janela = SRC.slice(idx, idx + 2000);
    // Ambos precisam viver no mesmo grid (não pode haver </div> fechando o grid
    // antes do shipping-cost-input).
    const fobPreIdx = janela.indexOf("s.shippingType === 'fob_pre'");
    const shippingCostIdx = janela.indexOf('shipping-cost-input');
    expect(fobPreIdx).toBeGreaterThan(0);
    expect(shippingCostIdx).toBeGreaterThan(fobPreIdx);
  });
});
