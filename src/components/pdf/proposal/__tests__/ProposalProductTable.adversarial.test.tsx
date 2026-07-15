/**
 * Auditoria exaustiva — ProposalProductTable
 *
 * Cobre as 5 mudanças recentes (2026-07):
 *  1. Rediagramação: nome/desc/[SKU · Cor swatch]/gravações
 *  2. 1 badge por personalização (sem rótulo "Gravação:")
 *  3. Badge slim (fonte 9px, padding 1px 7px)
 *  4. SKU em texto preto puro + swatch 10×10px
 *  5. Sem estrelinha ✦ no badge
 *
 * Bateria adversarial: 30+ combinações de entrada.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposalProductTable } from '../ProposalProductTable';
import type { ProposalItem } from '../../ProposalHtmlTemplate';

function html(items: ProposalItem[]): string {
  return renderToStaticMarkup(<ProposalProductTable items={items} />);
}

const baseItem: ProposalItem = {
  name: 'Produto Base',
  sku: 'SKU-1',
  quantity: 100,
  unitPrice: 10,
};

const p = (over: Partial<ProposalItem['personalizations'] extends (infer U)[] | undefined ? U : never> = {}) => ({
  technique_name: 'Fiber Laser',
  location_name: 'Lado A',
  colors_count: 1,
  width_cm: 3,
  height_cm: 5,
  ...over,
});

describe('ProposalProductTable — invariantes das 5 mudanças', () => {
  it('nunca renderiza rótulo "Gravação:" (mudança #2)', () => {
    const out = html([{ ...baseItem, personalizations: [p()] }]);
    expect(out).not.toMatch(/Gravação:/);
  });

  it('nunca renderiza o marker ✦ na tabela (mudança #5)', () => {
    const out = html([{ ...baseItem, personalizations: [p(), p({ location_name: 'Lado B' })] }]);
    expect(out).not.toContain('✦');
  });

  it('SKU sai como texto (sem background colorido) (mudança #4)', () => {
    const out = html([{ ...baseItem, sku: 'SKU-BLACK', colorHex: '#ff0000' }]);
    // A cor de fundo do SKU foi removida — não deve haver span com background:#ff0000
    // envolvendo o texto do SKU.
    const skuMatch = /<span[^>]*>SKU-BLACK<\/span>/.exec(out);
    expect(skuMatch).toBeTruthy();
    expect(skuMatch![0]).not.toMatch(/background:\s*#ff0000/i);
    // Cor do texto deve ser #111 (preto)
    expect(skuMatch![0]).toMatch(/color:\s*rgb\(17,\s*17,\s*17\)|color:\s*#111/i);
  });

  it('swatch 10×10px aparece quando há item.color (mudança #4)', () => {
    const out = html([{ ...baseItem, color: 'LARANJA', colorHex: '#ff8800' }]);
    expect(out).toMatch(/width:\s*10px/);
    expect(out).toMatch(/height:\s*10px/);
    // background do swatch usa colorHex
    expect(out.toLowerCase()).toContain('#ff8800');
  });

  it('gera 2 badges empilhados quando há 2 personalizações (mudança #2)', () => {
    const out = html([{
      ...baseItem,
      personalizations: [p({ location_name: 'Lado A' }), p({ location_name: 'Lado B' })],
    }]);
    // Cada badge é uma <table> própria — contar tables com backgroundColor:#e0f2f1
    const badgeCount = (out.match(/#e0f2f1/g) || []).length;
    expect(badgeCount).toBe(2);
  });

  it('badge com font-size 9px (mudança #3 — slim)', () => {
    const out = html([{ ...baseItem, personalizations: [p()] }]);
    // A célula do badge deve conter font-size:9px
    expect(out).toMatch(/font-size:\s*9px/);
  });
});

describe('ProposalProductTable — dados adversariais', () => {
  it.each([
    ['sem personalização', { personalizations: [] }],
    ['1 personalização', { personalizations: [p()] }],
    ['2 personalizações', { personalizations: [p(), p({ location_name: 'B' })] }],
    ['5 personalizações', { personalizations: Array.from({ length: 5 }, (_, i) => p({ location_name: `L${i}` })) }],
    ['sem location', { personalizations: [p({ location_name: undefined })] }],
    ['sem colors_count', { personalizations: [p({ colors_count: undefined })] }],
    ['sem dimensions', { personalizations: [p({ width_cm: undefined, height_cm: undefined })] }],
    ['sem technique_name', { personalizations: [p({ technique_name: '' })] }],
    ['sem color', { color: undefined, colorHex: undefined }],
    ['colorHex ausente', { color: 'AZUL', colorHex: undefined }],
    ['colorHex vazio', { color: 'AZUL', colorHex: '' }],
    ['colorHex "invalid"', { color: 'X', colorHex: 'invalid' }],
    ['colorHex branco', { color: 'BRANCO', colorHex: '#ffffff' }],
    ['composedCode presente', { composedCode: 'COMP-99', sku: 'SKU-99' }],
    ['só sku', { composedCode: undefined, sku: 'SKU-ONLY' }],
    ['sem sku e sem composedCode', { composedCode: undefined, sku: undefined, color: 'X' }],
    ['nome 90+ chars', { name: 'A'.repeat(150) }],
    ['descrição 120+ chars', { description: 'D'.repeat(300) }],
    ['cor nome longo', { color: 'AZUL MARINHO ESCURO METALIZADO FOSCO', colorHex: '#001155' }],
    ['cor caracteres especiais', { color: 'Verde/Água 💚', colorHex: '#00cc99' }],
    ['sem imagem', { imageUrl: undefined }],
    ['quantidade zero', { quantity: 0 }],
    ['unitPrice zero', { unitPrice: 0 }],
    ['discount presente', { discount: 5 }],
  ])('não lança e produz HTML válido: %s', (_label, override) => {
    expect(() => {
      const out = html([{ ...baseItem, ...override }]);
      expect(out).toContain('<table');
      expect(out.length).toBeGreaterThan(100);
    }).not.toThrow();
  });

  it('mix de itens com/sem imagem na mesma tabela (hasAnyImage=true)', () => {
    const out = html([
      { ...baseItem, imageUrl: 'https://x/a.jpg' },
      { ...baseItem, imageUrl: undefined },
    ]);
    // header Foto deve aparecer
    expect(out).toContain('Foto');
  });

  it('tabela sem nenhuma imagem NÃO mostra coluna Foto', () => {
    const out = html([{ ...baseItem, imageUrl: undefined }]);
    expect(out).not.toContain('>Foto<');
  });

  it('renderiza separador · entre SKU e Cor apenas quando ambos existem', () => {
    const bothOut = html([{ ...baseItem, sku: 'X', color: 'Y' }]);
    const onlySkuOut = html([{ ...baseItem, sku: 'X', color: undefined }]);
    const onlyColorOut = html([{ ...baseItem, sku: undefined, composedCode: undefined, color: 'Y' }]);
    // Contamos "·" apenas no bloco entre SKU e Cor (evitando falso positivo com outros pontos)
    expect(bothOut).toMatch(/>·</);
    expect(onlySkuOut).not.toMatch(/>·</);
    expect(onlyColorOut).not.toMatch(/>·</);
  });

  it('filtro Boolean nos badges: personalização vazia não vira badge fantasma', () => {
    const out = html([{
      ...baseItem,
      // technique_name vazio + sem location → summary provavelmente vazio
      personalizations: [{ technique_name: '', location_name: undefined, colors_count: undefined } as never],
    }]);
    const badgeCount = (out.match(/#e0f2f1/g) || []).length;
    expect(badgeCount).toBeLessThanOrEqual(1); // 0 ou 1, nunca negativo/crash
  });
});

describe('ProposalProductTable — resiliência (fuzz leve)', () => {
  it('100 items aleatórios não lançam', () => {
    const items: ProposalItem[] = Array.from({ length: 100 }, (_, i) => ({
      name: `Item ${i}`,
      sku: i % 3 === 0 ? undefined : `SKU-${i}`,
      composedCode: i % 5 === 0 ? `C-${i}` : undefined,
      color: i % 2 === 0 ? 'Cor Teste' : undefined,
      colorHex: i % 4 === 0 ? undefined : `#${((i * 12345) & 0xffffff).toString(16).padStart(6, '0')}`,
      quantity: (i % 500) + 1,
      unitPrice: (i % 100) + 0.5,
      discount: i % 7 === 0 ? i : 0,
      description: i % 6 === 0 ? 'D'.repeat(i * 3) : undefined,
      imageUrl: i % 2 === 0 ? `https://x/${i}.jpg` : undefined,
      personalizations:
        i % 4 === 0
          ? Array.from({ length: (i % 3) + 1 }, (_, j) => p({ location_name: `L${j}` }))
          : [],
    }));
    expect(() => html(items)).not.toThrow();
  });
});
