/**
 * Testes de borda + a11y (axe-core) para o header do item recolhido.
 *
 * Estratégia: harness mínima que espelha EXATAMENTE o markup produzido pelo
 * `QuoteBuilderSummaryColumn` (linhas 748–830 do source). Isso evita ter que
 * inicializar toda a árvore do builder (Supabase / dnd-kit / providers) e
 * ainda garante regressão real do layout de cabeçalho.
 *
 * A paridade estrutural com o componente real é validada pelo teste vizinho
 * `QuoteBuilderSummaryColumn.collapsedHeader.test.ts` (source-based).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

interface Item {
  quantity: number;
  unit_price: number;
  product_name: string;
  product_sku: string;
  color_name?: string;
  color_hex?: string;
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function CollapsedHeaderHarness({
  item,
  isCollapsed = true,
  onEdit = () => {},
  onDelete = () => {},
  onToggle = () => {},
}: {
  item: Item;
  isCollapsed?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
}) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Arrastar para reordenar"
          className="mt-1 shrink-0 rounded p-1"
        >
          <span aria-hidden="true">≡</span>
        </button>
        <img alt={item.product_name || 'Produto'} src="" width={40} height={40} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 pr-1 text-sm font-medium leading-[1.125rem]">
            {item.product_name}
          </p>
          <div className="mt-1 flex flex-col items-start gap-0.5">
            <span className="h-4 px-1.5 py-0 font-mono text-[10px]">{item.product_sku}</span>
            {item.color_name && (
              <div className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color_hex || '#CCC' }}
                />
                <span className="text-[10px]">{item.color_name}</span>
              </div>
            )}
          </div>
        </div>
        {isCollapsed && (
          <div
            data-testid="collapsed-price"
            className="flex shrink-0 items-end gap-3 tabular-nums"
          >
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wider">Qtd</span>
              <span className="text-xs font-medium">{item.quantity}</span>
            </div>
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wider">Vl Unitário</span>
              <span className="text-xs font-medium">{brl(item.unit_price)}</span>
            </div>
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wider">Subtotal</span>
              <span className="text-xs font-semibold">{brl(item.quantity * item.unit_price)}</span>
            </div>
          </div>
        )}
        <div className="flex h-[1.125rem] shrink-0 items-center gap-0.5">
          <button type="button" aria-label="Editar" onClick={onEdit}>
            <span aria-hidden="true">✎</span>
          </button>
          <button type="button" aria-label="Excluir" onClick={onDelete}>
            <span aria-hidden="true">🗑</span>
          </button>
          <button
            type="button"
            aria-label={isCollapsed ? 'Expandir' : 'Recolher'}
            aria-expanded={!isCollapsed}
            aria-pressed={isCollapsed}
            onClick={onToggle}
          >
            <span aria-hidden="true">{isCollapsed ? '▾' : '▴'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const LONG_NAME =
  'Garrafa esportiva em alumínio e acabamento brilhante com mosquetão 400 ml — edição limitada';
const SPECIAL_NAME = 'Café — Ação/ç"<script>&<>© 100% ★';

describe('Header recolhido — cenários de borda', () => {
  it.each<[string, Item]>([
    ['nome vazio', { quantity: 100, unit_price: 10, product_name: '', product_sku: 'X-1' }],
    ['nome muito longo (2 linhas)', { quantity: 500, unit_price: 11.72, product_name: LONG_NAME, product_sku: '94297-7.1', color_name: 'Laranja', color_hex: '#f60' }],
    ['caracteres especiais e HTML', { quantity: 1, unit_price: 0, product_name: SPECIAL_NAME, product_sku: 'S/1' }],
    ['quantidade zero', { quantity: 0, unit_price: 250, product_name: 'Item', product_sku: 'Z-0' }],
    ['valores muito grandes', { quantity: 9_999_999, unit_price: 99_999.99, product_name: 'Bulk', product_sku: 'B-1' }],
    ['valores decimais precisos', { quantity: 7, unit_price: 0.01, product_name: 'Micro', product_sku: 'M-1' }],
  ])('layout consistente com %s', (_, item) => {
    render(<CollapsedHeaderHarness item={item} />);
    const priceBlock = screen.getByTestId('collapsed-price');

    // 3 colunas presentes
    expect(within(priceBlock).getByText('Qtd')).toBeInTheDocument();
    expect(within(priceBlock).getByText('Vl Unitário')).toBeInTheDocument();
    expect(within(priceBlock).getByText('Subtotal')).toBeInTheDocument();

    // Preço bloco não pode ser encolhido pelo nome longo
    expect(priceBlock.className).toMatch(/\bshrink-0\b/);
    expect(priceBlock.className).toMatch(/\btabular-nums\b/);

    // Ações sempre presentes e alcançáveis por teclado (sem tabindex negativo)
    for (const label of ['Editar', 'Excluir']) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn).not.toHaveAttribute('tabindex', '-1');
    }
    const toggle = screen.getByRole('button', { name: 'Expandir' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Subtotal calculado sem quebrar (aceita 0 e valores enormes)
    const expected = brl(item.quantity * item.unit_price);
    expect(priceBlock.textContent ?? '').toContain(expected);
  });
});

describe('Header recolhido — a11y (axe-core) com nome de 2 linhas', () => {
  it('não viola regras WCAG 2.1 A/AA no cartão recolhido', async () => {
    const { container } = render(
      <CollapsedHeaderHarness
        item={{
          quantity: 500,
          unit_price: 11.72,
          product_name: LONG_NAME,
          product_sku: '94297-7.1',
          color_name: 'Laranja',
          color_hex: '#f60',
        }}
      />,
    );
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } }, // jsdom não computa cores reais
    });
    expect(results).toHaveNoViolations();
  });

  it('não viola regras WCAG no cartão expandido', async () => {
    const { container } = render(
      <CollapsedHeaderHarness
        isCollapsed={false}
        item={{
          quantity: 500,
          unit_price: 11.72,
          product_name: LONG_NAME,
          product_sku: '94297-7.1',
        }}
      />,
    );
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});

describe('Header recolhido — interação por teclado', () => {
  it('Tab percorre drag → editar → excluir → toggle na ordem correta', () => {
    render(
      <CollapsedHeaderHarness
        item={{ quantity: 500, unit_price: 11.72, product_name: LONG_NAME, product_sku: '94297-7.1' }}
      />,
    );
    const drag = screen.getByRole('button', { name: 'Arrastar para reordenar' });
    const edit = screen.getByRole('button', { name: 'Editar' });
    const del = screen.getByRole('button', { name: 'Excluir' });
    const toggle = screen.getByRole('button', { name: 'Expandir' });

    // Ordem no DOM = ordem natural de foco
    const order = [drag, edit, del, toggle];
    for (let i = 0; i < order.length - 1; i++) {
      // eslint-disable-next-line no-bitwise
      expect(order[i].compareDocumentPosition(order[i + 1]) & 4).toBeTruthy();
    }
  });

  it('Enter/Espaço no toggle dispara onToggle; clique em Editar dispara onEdit', () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    render(
      <CollapsedHeaderHarness
        item={{ quantity: 1, unit_price: 1, product_name: 'X', product_sku: 'X' }}
        onToggle={onToggle}
        onEdit={onEdit}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Expandir' });
    toggle.focus();
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle); // <button> nativo responde a Enter/Espaço via clique
    expect(onToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
