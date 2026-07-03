/**
 * Smoke estrutural: garante invariantes do bloco Frete no QuoteBuilderPage
 * que previnem regressões de layout em diferentes larguras de tela
 * (mobile empilhado / md+ em 3 colunas) e evitam regressões de JSX
 * mal-balanceado como as que já causaram "Unexpected token" no build.
 *
 * Nota: a verificação de compilação real ("tsc --noEmit" + "npm run build")
 * roda no workflow build-typecheck.yml a cada PR — este teste é a
 * primeira linha de defesa, barata e rápida.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../QuoteBuilderPage.tsx'), 'utf8');

describe('QuoteBuilderPage — bloco Frete: layout responsivo', () => {
  it('usa grid grid-cols-1 md:grid-cols-3 gap-3 items-end (empilha em mobile, 3 col em md+)', () => {
    expect(SRC).toMatch(
      /<div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end" data-testid="freight-grid">\s*<div className="space-y-1" data-testid="freight-grid-col-1">[^]*?<Select\s+data-testid="shipping-type-select-root"/,
    );
  });

  it('labels Frete e Valor R$ vivem dentro das células do grid para não aumentar o container só no fob_pre', () => {
    expect(SRC).toMatch(
      /data-testid="freight-grid-col-1"[^]*?>[^]*?<Label[^]*?>[^]*?Frete[^]*?<\/Label>[^]*?shipping-type-select-root/,
    );
    expect(SRC).toMatch(
      /data-testid="freight-grid-col-2"[^]*?>[^]*?<Label[^]*?>[^]*?Valor R\$[^]*?<\/Label>[^]*?shipping-cost-input/,
    );
  });

  it('input "Valor R$" (fob_pre) vive DENTRO do mesmo grid do trigger (2ª coluna)', () => {
    const gridIdx = SRC.indexOf('grid grid-cols-1 md:grid-cols-3 gap-3 items-end');
    expect(gridIdx).toBeGreaterThan(0);
    const janela = SRC.slice(gridIdx, gridIdx + 3000);
    const fobPreIdx = janela.indexOf("s.shippingType === 'fob_pre'");
    const shippingCostIdx = janela.indexOf('shipping-cost-input');
    expect(fobPreIdx).toBeGreaterThan(0);
    expect(shippingCostIdx).toBeGreaterThan(fobPreIdx);
  });

  it('não existe bloco full-width legado envolvendo o Valor R$ (mt-1.5 + shipping-cost)', () => {
    expect(SRC).not.toMatch(/mt-1\.5 space-y-1[^"]*"[^]*?shipping-cost-input/);
  });

  it('JSX do bloco Frete tem <div> balanceados (open == close entre o wrapper externo e o próximo irmão)', () => {
    const start = SRC.indexOf('{/* Frete */}');
    const end = SRC.indexOf('{s.companyInfo?.id', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const bloco = SRC.slice(start, end);
    const opens = (bloco.match(/<div\b/g) ?? []).length;
    const closes = (bloco.match(/<\/div>/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});
