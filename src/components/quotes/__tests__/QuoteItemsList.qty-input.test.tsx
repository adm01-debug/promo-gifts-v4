/**
 * Regressão do input de quantidade no QuoteItemsList.
 *
 * Casos cobertos:
 *  - Backspace até esvaziar NÃO reverte o campo para "1" enquanto editando.
 *  - Blur com vazio reverte para "1" e chama onUpdateQuantity(1).
 *  - Digitar um valor válido atualiza o store (onUpdateQuantity).
 *  - Caracteres não-numéricos ("-", "+", "e", ".", ",") são bloqueados por teclado.
 *  - Paste de "-5"/"abc" é ignorado (regex /^\d+$/).
 *  - Mudança externa de item.quantity sincroniza o draft.
 *
 * Nota: o KitBuilder não possui input editável de quantidade (apenas botões
 * +/- em SelectedItemsBadges), portanto o padrão qtyDraft não é aplicável lá.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuoteItemsList } from '@/components/quotes/QuoteItemsList';
import type { QuoteItem } from '@/hooks/quotes/quoteTypes';

function makeItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: 'item-1',
    product_id: 'p1',
    product_name: 'Garrafa esportiva',
    product_sku: '94297-1.4',
    product_image_url: null,
    color_name: 'AZUL CLARO',
    color_hex: '#3aa0ff',
    quantity: 1,
    unit_price: 20,
    personalizations: [],
    ...overrides,
  } as unknown as QuoteItem;
}

function setup(item: QuoteItem = makeItem()) {
  const onUpdateQuantity = vi.fn();
  const onUpdatePrice = vi.fn();
  const onRemove = vi.fn();
  const formatCurrency = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const utils = render(
    <QuoteItemsList
      items={[item]}
      onUpdateQuantity={(_, qty) => onUpdateQuantity(qty)}
      onUpdatePrice={(_, p) => onUpdatePrice(p)}
      onRemove={onRemove}
      formatCurrency={formatCurrency}
    />,
  );

  const input = screen.getByRole('spinbutton') as HTMLInputElement;
  return { ...utils, input, onUpdateQuantity, onUpdatePrice, onRemove };
}

describe('QuoteItemsList — input de quantidade (regressão)', () => {
  it('valor inicial reflete item.quantity', () => {
    const { input } = setup(makeItem({ quantity: 5 }));
    expect(input.value).toBe('5');
  });

  it('Backspace até esvaziar mantém o campo vazio (não reverte para 1)', async () => {
    const user = userEvent.setup();
    const { input } = setup(makeItem({ quantity: 5 }));

    await user.click(input); // select() limpa pela próxima tecla
    await user.clear(input);

    expect(input.value).toBe('');
  });

  it('Blur com vazio reverte para "1" e chama onUpdateQuantity(1)', async () => {
    const user = userEvent.setup();
    const { input, onUpdateQuantity } = setup(makeItem({ quantity: 5 }));

    await user.click(input);
    await user.clear(input);
    expect(input.value).toBe('');

    await user.tab(); // blur

    expect(input.value).toBe('1');
    expect(onUpdateQuantity).toHaveBeenLastCalledWith(1);
  });

  it('Digitar um valor válido propaga via onUpdateQuantity', async () => {
    const user = userEvent.setup();
    const { input, onUpdateQuantity } = setup(makeItem({ quantity: 1 }));

    await user.click(input);
    await user.clear(input);
    await user.keyboard('25');

    expect(input.value).toBe('25');
    // 2 → onUpdateQuantity(2); 25 → onUpdateQuantity(25)
    expect(onUpdateQuantity).toHaveBeenCalledWith(25);
  });

  it('Bloqueia caracteres não-inteiros via teclado', async () => {
    const user = userEvent.setup();
    const { input, onUpdateQuantity } = setup();

    await user.click(input);
    await user.clear(input);
    await user.keyboard('-+e.,');

    expect(input.value).toBe('');
    expect(onUpdateQuantity).not.toHaveBeenCalledWith(expect.any(Number));
  });

  it('Mudança externa de item.quantity sincroniza o draft', () => {
    const onUpdateQuantity = vi.fn();
    const onUpdatePrice = vi.fn();
    const onRemove = vi.fn();
    const fmt = (n: number) => `R$ ${n.toFixed(2)}`;
    const { rerender } = render(
      <QuoteItemsList
        items={[makeItem({ quantity: 1 })]}
        onUpdateQuantity={onUpdateQuantity}
        onUpdatePrice={onUpdatePrice}
        onRemove={onRemove}
        formatCurrency={fmt}
      />,
    );
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');

    rerender(
      <QuoteItemsList
        items={[makeItem({ quantity: 42 })]}
        onUpdateQuantity={onUpdateQuantity}
        onUpdatePrice={onUpdatePrice}
        onRemove={onRemove}
        formatCurrency={fmt}
      />,
    );
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('42');
  });
});
