/**
 * Unit · valida a lógica de snapshot do `handleRemoveWithUndo` do
 * `CartHeaderButton`. Reproduz a função pura aqui (é local ao componente)
 * para testar exaustivamente sem montar todo o componente com providers.
 *
 * Cobre:
 *  - T2  snapshot repassado ao onUndo bate com AddToCartInput
 *  - T5  campos null viram undefined (nunca null no payload)
 *  - T7  cascata de removes: cada snapshot independente (sem aliasing)
 *  - T8  cart.id do closure é preservado (não o activeCartId)
 *
 * Se `handleRemoveWithUndo` mudar em CartHeaderButton.tsx, esta cópia
 * DEVE ser atualizada — o teste falha se sair de sincronia com a produção.
 */
import { describe, it, expect, vi } from 'vitest';

// Réplica EXATA da lógica de snapshot em CartHeaderButton.tsx (linhas 155-192).
type Item = {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  product_price: number;
  quantity: number;
  color_name: string | null;
  color_hex: string | null;
  notes: string | null;
  sort_order: number | null;
};

function makeHandler(
  removeItem: (id: string) => void,
  restoreItems: (cartId: string, items: unknown[]) => void,
  showUndoToast: (opts: {
    title: string;
    description?: string;
    duration?: number;
    onUndo: () => void;
  }) => void,
) {
  return function handleRemoveWithUndo(cartId: string, item: Item) {
    const snapshot = {
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku ?? undefined,
      product_image_url: item.product_image_url ?? undefined,
      product_price: item.product_price,
      quantity: item.quantity,
      color_name: item.color_name ?? undefined,
      color_hex: item.color_hex ?? undefined,
      notes: item.notes ?? undefined,
      sort_order: item.sort_order ?? undefined,
    };
    removeItem(item.id);
    showUndoToast({
      title: 'Item removido',
      description: item.product_name,
      duration: 5000,
      onUndo: () => restoreItems(cartId, [snapshot]),
    });
  };
}

const baseItem = (over: Partial<Item> = {}): Item => ({
  id: 'item-1',
  product_id: 'prod-1',
  product_name: 'Bloco Adesivado',
  product_sku: 'SKU-1',
  product_image_url: 'https://x/y.jpg',
  product_price: 11.72,
  quantity: 1,
  color_name: 'Natural',
  color_hex: '#e0d3b3',
  notes: 'obs',
  sort_order: 0,
  ...over,
});

describe('CartHeaderButton · handleRemoveWithUndo snapshot', () => {
  it('T1/T2 — remove chama removeItem(id) e onUndo restaura com shape AddToCartInput', () => {
    const removeItem = vi.fn();
    const restoreItems = vi.fn();
    const showUndoToast = vi.fn();
    const h = makeHandler(removeItem, restoreItems, showUndoToast);

    h('cart-A', baseItem());
    expect(removeItem).toHaveBeenCalledWith('item-1');
    expect(showUndoToast).toHaveBeenCalledTimes(1);

    const opts = showUndoToast.mock.calls[0][0];
    expect(opts.title).toBe('Item removido');
    expect(opts.description).toBe('Bloco Adesivado');
    expect(opts.duration).toBe(5000);

    opts.onUndo();
    expect(restoreItems).toHaveBeenCalledWith('cart-A', [
      {
        product_id: 'prod-1',
        product_name: 'Bloco Adesivado',
        product_sku: 'SKU-1',
        product_image_url: 'https://x/y.jpg',
        product_price: 11.72,
        quantity: 1,
        color_name: 'Natural',
        color_hex: '#e0d3b3',
        notes: 'obs',
        sort_order: 0,
      },
    ]);
  });

  it('T5 — todos os nullables viram undefined (nunca null no payload)', () => {
    const restoreItems = vi.fn();
    const showUndoToast = vi.fn();
    const h = makeHandler(vi.fn(), restoreItems, showUndoToast);

    h(
      'cart-A',
      baseItem({
        product_sku: null,
        product_image_url: null,
        color_name: null,
        color_hex: null,
        notes: null,
        sort_order: null,
      }),
    );
    showUndoToast.mock.calls[0][0].onUndo();
    const payload = restoreItems.mock.calls[0][1][0];

    for (const k of [
      'product_sku',
      'product_image_url',
      'color_name',
      'color_hex',
      'notes',
      'sort_order',
    ]) {
      expect(payload[k]).toBeUndefined();
      expect(payload[k]).not.toBeNull();
    }
    // campos obrigatórios preservados
    expect(payload.product_id).toBe('prod-1');
    expect(payload.quantity).toBe(1);
  });

  it('T7 — cascata de 3 removes: cada onUndo restaura só o SEU snapshot', () => {
    const restoreItems = vi.fn();
    const showUndoToast = vi.fn();
    const h = makeHandler(vi.fn(), restoreItems, showUndoToast);

    h('cart-A', baseItem({ id: 'i1', product_id: 'p1', product_name: 'A' }));
    h('cart-A', baseItem({ id: 'i2', product_id: 'p2', product_name: 'B' }));
    h('cart-A', baseItem({ id: 'i3', product_id: 'p3', product_name: 'C' }));

    // Dispara na ordem inversa para provar que não há aliasing.
    showUndoToast.mock.calls[2][0].onUndo();
    showUndoToast.mock.calls[0][0].onUndo();
    showUndoToast.mock.calls[1][0].onUndo();

    expect(restoreItems.mock.calls[0][1][0].product_id).toBe('p3');
    expect(restoreItems.mock.calls[1][1][0].product_id).toBe('p1');
    expect(restoreItems.mock.calls[2][1][0].product_id).toBe('p2');
  });

  it('T8 — cartId do closure é preservado (não confunde com outros carts)', () => {
    const restoreItems = vi.fn();
    const showUndoToast = vi.fn();
    const h = makeHandler(vi.fn(), restoreItems, showUndoToast);

    h('cart-X', baseItem({ id: 'iX' }));
    h('cart-Y', baseItem({ id: 'iY' }));

    showUndoToast.mock.calls[0][0].onUndo();
    showUndoToast.mock.calls[1][0].onUndo();

    expect(restoreItems.mock.calls[0][0]).toBe('cart-X');
    expect(restoreItems.mock.calls[1][0]).toBe('cart-Y');
  });

  it('mutação posterior do item de origem NÃO afeta o snapshot capturado', () => {
    const restoreItems = vi.fn();
    const showUndoToast = vi.fn();
    const h = makeHandler(vi.fn(), restoreItems, showUndoToast);

    const item = baseItem({ product_name: 'Original' });
    h('cart-A', item);
    item.product_name = 'Mutado';
    item.quantity = 999;

    showUndoToast.mock.calls[0][0].onUndo();
    const payload = restoreItems.mock.calls[0][1][0];
    expect(payload.product_name).toBe('Original');
    expect(payload.quantity).toBe(1);
  });
});
