/**
 * Regressão estrutural do header do item no Resumo do Orçamento.
 *
 * Cobre as mudanças recentes:
 *  - Nome do produto em até 2 linhas (line-clamp-2, sem truncate)
 *  - SKU e cor empilhados verticalmente (flex-col) com cor abaixo do código
 *  - Bloco de preço recolhido com Qtd / Vl Unitário / Subtotal empilhados
 *  - Paridade de spacing com NegotiationMarkupCard (px-3)
 *  - Ordem DOM preservada para leitura por teclado (name → sku/color → price → ações)
 *
 * Estratégia: asserções estáticas sobre o source do arquivo. Rápido, sem depender
 * de mocks pesados do @dnd-kit/store/Supabase que a árvore real do componente exige.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(__dirname, '../QuoteBuilderSummaryColumn.tsx'),
  'utf-8',
);
const NEGOTIATION_SOURCE = readFileSync(
  resolve(__dirname, '../NegotiationMarkupCard.tsx'),
  'utf-8',
);

/** Slice do header do item (do bloco do nome até o fim dos botões de ação). */
function headerSlice(): string {
  const start = SOURCE.indexOf('{item.product_name}');
  const end = SOURCE.indexOf(
    'Ocultar detalhes',
    start,
  );
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start - 500, end + 200);
}

describe('QuoteBuilderSummaryColumn — header do item (visual/estrutural)', () => {
  it('nome do produto usa line-clamp-2 (2 linhas) e não usa truncate', () => {
    const slice = headerSlice();
    expect(slice).toMatch(/line-clamp-2[^"]*"\s*>\s*\{item\.product_name\}/);
    // Garante que o parágrafo do nome NÃO voltou para truncate
    const namePara = slice.match(/<p[^>]*>\s*\{item\.product_name\}/);
    expect(namePara?.[0] ?? '').not.toMatch(/\btruncate\b/);
  });

  it('SKU e cor ficam empilhados verticalmente (flex-col), cor abaixo do código', () => {
    const slice = headerSlice();
    // Container do SKU+cor deve usar flex-col
    expect(slice).toMatch(/mt-1 flex flex-col items-start gap-0\.5/);
    // Ordem DOM: SKU (Badge com product_sku) aparece ANTES da cor (color_name)
    const skuIdx = slice.indexOf('{item.product_sku}');
    const colorIdx = slice.indexOf('{item.color_name}');
    expect(skuIdx).toBeGreaterThan(-1);
    expect(colorIdx).toBeGreaterThan(-1);
    expect(skuIdx).toBeLessThan(colorIdx);
  });

  it('bloco recolhido exibe Qtd / Vl Unitário / Subtotal empilhados com rótulos uppercase', () => {
    const slice = headerSlice();
    expect(slice).toMatch(/isCollapsed && \(/);
    expect(slice).toMatch(/quote-summary-collapsed-price-\$\{idx\}/);
    // Três colunas com rótulo em cima e valor embaixo
    expect(slice).toMatch(/uppercase tracking-wider text-muted-foreground\/70[^>]*>\s*Qtd/);
    expect(slice).toMatch(/uppercase tracking-wider text-muted-foreground\/70[^>]*>\s*Vl Unitário/);
    expect(slice).toMatch(/uppercase tracking-wider text-muted-foreground\/70[^>]*>\s*Subtotal/);
    // Valores usam tabular-nums para alinhamento numérico
    expect(slice).toMatch(/tabular-nums/);
    // Ordem DOM: Qtd → Vl Unitário → Subtotal
    const q = slice.indexOf('>\n                                            Qtd');
    const u = slice.indexOf('Vl Unitário');
    const s = slice.indexOf('Subtotal');
    expect(q).toBeLessThan(u);
    expect(u).toBeLessThan(s);
  });

  it('ordem DOM do header preserva leitura por teclado: nome → SKU → cor → preço recolhido → ações', () => {
    const slice = headerSlice();
    const name = slice.indexOf('{item.product_name}');
    const sku = slice.indexOf('{item.product_sku}');
    const color = slice.indexOf('{item.color_name}');
    const collapsedPrice = slice.indexOf('quote-summary-collapsed-price');
    const editBtn = slice.indexOf('aria-label="Editar"');
    const deleteBtn = slice.indexOf('aria-label="Excluir"');
    const toggleBtn = slice.indexOf("aria-label={isCollapsed ? 'Expandir' : 'Recolher'}");

    // Cada elemento existe
    for (const idx of [name, sku, color, collapsedPrice, editBtn, deleteBtn, toggleBtn]) {
      expect(idx).toBeGreaterThan(-1);
    }
    // Ordem estrita
    expect(name).toBeLessThan(sku);
    expect(sku).toBeLessThan(color);
    expect(color).toBeLessThan(collapsedPrice);
    expect(collapsedPrice).toBeLessThan(editBtn);
    expect(editBtn).toBeLessThan(deleteBtn);
    expect(deleteBtn).toBeLessThan(toggleBtn);
  });

  it('container do header usa items-start (nome de 2 linhas não sobrepõe elementos abaixo)', () => {
    const slice = headerSlice();
    // O row do header é flex items-start gap-2 — mantém alinhamento pelo topo
    // mesmo quando o nome ocupa 2 linhas.
    expect(SOURCE).toMatch(/<div className="flex items-start gap-2">/);
    // Card interno preserva o padding vertical p-3 (respiro consistente)
    expect(SOURCE).toMatch(/<div className="space-y-2 p-3">/);
    // Guard: bloco recolhido é shrink-0 para não empurrar o nome
    expect(slice).toMatch(/flex shrink-0 items-end gap-3 tabular-nums/);
  });
});

describe('QuoteBuilderSummaryColumn ↔ NegotiationMarkupCard — paridade de spacing', () => {
  it('ambos usam px-3 como padding horizontal base (mobile)', () => {
    // Card do item no Resumo
    expect(SOURCE).toMatch(/space-y-2 p-3/);
    // Card de Margem
    expect(NEGOTIATION_SOURCE).toMatch(/px-3 py-2\.5 sm:space-y-1\.5 sm:px-2\.5 sm:py-2/);
  });

  it('linha de desconto do NegotiationMarkupCard preserva pt-2 + border-t (alinhamento com resumo)', () => {
    expect(NEGOTIATION_SOURCE).toMatch(/negotiation-price-grid/);
    expect(NEGOTIATION_SOURCE).toMatch(/border-t border-border\/40 pt-2/);
  });
});
