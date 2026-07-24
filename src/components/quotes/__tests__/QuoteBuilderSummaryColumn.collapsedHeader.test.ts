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
  it('nome do produto força quebra em até 2 linhas (webkit-box + WebkitLineClamp) e não usa truncate', () => {
    const slice = headerSlice();
    // Inline style com WebkitLineClamp:2 + display:-webkit-box (garante 2 linhas
    // mesmo quando o Tailwind purge/plugin não injeta line-clamp).
    expect(slice).toMatch(/WebkitLineClamp:\s*2/);
    expect(slice).toMatch(/display:\s*['"]-webkit-box['"]/);
    expect(slice).toMatch(/WebkitBoxOrient:\s*['"]vertical['"]/);
    const namePara = /<p[\s\S]*?\{item\.product_name\}/.exec(slice);
    expect(namePara?.[0] ?? '').not.toMatch(/\btruncate\b/);
    expect(namePara?.[0] ?? '').toMatch(/\bbreak-words\b/);
  });

  it('SKU e cor ficam na mesma linha (flex-wrap items-center), cor logo após o código', () => {
    const slice = headerSlice();
    // Container do SKU+cor deve usar flex-wrap na mesma linha
    expect(slice).toMatch(/mt-1 flex flex-wrap items-center gap-x-2 gap-y-0\.5/);
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
    expect(slice).toMatch(/flex shrink-0 items-start gap-8 tabular-nums/);
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

describe('QuoteBuilderSummaryColumn — modo Expandido inalterado', () => {
  it('bloco expandido (Qtd: X × R$ Y ... Total) permanece gated por !isCollapsed', () => {
    // A mudança do nome para 2 linhas não pode ter mexido no bloco expandido.
    expect(SOURCE).toMatch(/\{!isCollapsed && \(/);
    expect(SOURCE).toMatch(/<span className="text-muted-foreground">\s*Qtd:\s*<\/span>/);
    expect(SOURCE).toMatch(/formatCurrency\(item\.unit_price\)/);
    expect(SOURCE).toMatch(/formatCurrency\(item\.quantity \* item\.unit_price\)/);
    // "×" separador entre Qtd e unit_price no bloco expandido
    expect(SOURCE).toMatch(/<span className="text-muted-foreground">×<\/span>/);
  });

  it('bloco recolhido é mutuamente exclusivo do expandido (isCollapsed vs !isCollapsed)', () => {
    const collapsedIdx = SOURCE.indexOf('{isCollapsed && (');
    const expandedIdx = SOURCE.indexOf('{!isCollapsed && (');
    expect(collapsedIdx).toBeGreaterThan(-1);
    expect(expandedIdx).toBeGreaterThan(collapsedIdx);
  });
});

describe('QuoteBuilderSummaryColumn — a11y de teclado no cartão recolhido', () => {
  const slice = headerSlice();

  it('nenhum botão do header força tabIndex negativo (ordem natural de foco preservada)', () => {
    expect(slice).not.toMatch(/tabIndex=\{-1\}/);
    expect(slice).not.toMatch(/tabindex="-1"/i);
  });

  it('cada botão de ação expõe aria-label descritivo em PT-BR', () => {
    expect(slice).toMatch(/aria-label="Editar"/);
    expect(slice).toMatch(/aria-label="Excluir"/);
    expect(slice).toMatch(/aria-label=\{isCollapsed \? 'Expandir' : 'Recolher'\}/);
    // Drag handle vive fora do slice do header (antes do ProductThumb) — checar no SOURCE
    expect(SOURCE).toMatch(/aria-label="Arrastar para reordenar"/);
  });

  it('botão de toggle expõe aria-expanded e aria-pressed sincronizados com isCollapsed', () => {
    expect(slice).toMatch(/aria-expanded=\{!isCollapsed\}/);
    expect(slice).toMatch(/aria-pressed=\{isCollapsed\}/);
    expect(slice).toMatch(/data-collapsed=\{isCollapsed\}/);
  });

  it('ordem de foco por Tab segue DOM: drag → editar → excluir → toggle', () => {
    const drag = SOURCE.indexOf('aria-label="Arrastar para reordenar"');
    const edit = SOURCE.indexOf('aria-label="Editar"');
    const del = SOURCE.indexOf('aria-label="Excluir"');
    const toggle = SOURCE.indexOf("aria-label={isCollapsed ? 'Expandir' : 'Recolher'}");
    expect(drag).toBeGreaterThan(-1);
    expect(drag).toBeLessThan(edit);
    expect(edit).toBeLessThan(del);
    expect(del).toBeLessThan(toggle);
  });
});

describe('QuoteBuilderSummaryColumn — não sobreposição com nomes longos', () => {
  const slice = headerSlice();

  it('nome tem pr-2 (respiro à direita) para não colar no bloco de preço/ações', () => {
    const namePara = /<p[\s\S]*?\{item\.product_name\}/.exec(slice);
    expect(namePara?.[0] ?? '').toMatch(/\bpr-2\b/);
  });

  it('wrapper do nome (min-w-0 flex-1) tem pr-4 para separar da coluna QTD', () => {
    expect(slice).toMatch(/<div className="min-w-0 flex-1 pr-4">/);
  });

  it('nome mantém line-clamp=2 + overflow-hidden + leading-[1.125rem] (respiro entre linhas)', () => {
    const namePara = (/<p[\s\S]*?\{item\.product_name\}/.exec(slice))?.[0] ?? '';
    expect(namePara).toMatch(/WebkitLineClamp:\s*2/);
    expect(namePara).toMatch(/overflow-hidden/);
    expect(namePara).toMatch(/leading-\[1\.125rem\]/); // ~18px: garante que 2 linhas não colam
    expect(namePara).not.toMatch(/\btruncate\b/); // truncate em 1 linha quebraria layout multi-linha
    // SKU/cor entram com mt-1 para não colar na 2ª linha do nome
    expect(slice).toMatch(/mt-1 flex flex-wrap items-center gap-x-2 gap-y-0\.5/);
  });


  it('bloco de preço recolhido usa gap-8 entre Qtd / Vl Unitário / Subtotal (respiro suficiente)', () => {
    expect(slice).toMatch(/flex shrink-0 items-start gap-8 tabular-nums/);
    // Regressão: gap-4/gap-6 encostavam as colunas — não pode voltar
    expect(slice).not.toMatch(/items-start gap-4 tabular-nums/);
    expect(slice).not.toMatch(/items-start gap-6 tabular-nums/);
  });

  it('bloco de preço recolhido e ações são shrink-0 (não são comprimidos pelo nome longo)', () => {
    expect(slice).toMatch(/flex shrink-0 items-start gap-8 tabular-nums/); // preço
    expect(slice).toMatch(/flex h-\[1\.125rem\] shrink-0 items-center gap-0\.5/); // ações
  });

  it('cada coluna do bloco de preço usa gap-2 vertical entre rótulo e valor (respiro clean)', () => {
    // 3 colunas: Qtd (items-center), Vl Unitário e Subtotal (items-end) — todas com gap-2
    expect(slice).toMatch(/flex flex-col items-center gap-2"/);
    const endCols = slice.match(/flex flex-col items-end gap-2"/g) ?? [];
    expect(endCols.length).toBeGreaterThanOrEqual(2);
    // Regressão: gap-1 colava título ao valor — não pode voltar
    expect(slice).not.toMatch(/flex flex-col items-center gap-1"/);
    expect(slice).not.toMatch(/flex flex-col items-end gap-1"/);
  });




  it('valores numéricos (Qtd, unit_price, subtotal) usam tabular-nums para largura estável', () => {
    // Tabular-nums no wrapper garante largura consistente independente do valor
    expect(slice).toMatch(/tabular-nums/);
    // Subtotal é font-semibold para destaque visual sem alterar altura de linha
    expect(slice).toMatch(/text-xs font-semibold leading-none text-foreground/);
  });

  it('rótulos das 3 colunas usam text-[10px] uppercase (altura consistente entre variações)', () => {
    const labels = slice.match(/text-\[10px\] font-semibold uppercase tracking-wider/g) ?? [];
    // Um por coluna: Qtd, Vl Unitário, Subtotal
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });

  it('container do row usa items-start + gap-2 (nomes de 2 linhas alinham pelo topo, sem colisão)', () => {
    expect(SOURCE).toMatch(/<div className="flex items-start gap-2">/);
  });
});
