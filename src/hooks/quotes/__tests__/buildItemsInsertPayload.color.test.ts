/**
 * Garante que `buildItemsInsertPayload` exige `color_name` em todo item,
 * espelhando a constraint `quote_items_color_required` no Supabase.
 * Falha cedo no front-end e nunca envia POST sem cor para o backend.
 */
import { describe, it, expect } from 'vitest';
import { buildItemsInsertPayload } from '../quoteHelpers';
import type { QuoteItem } from '../quoteTypes';

const baseItem = (overrides: Partial<QuoteItem> = {}): QuoteItem =>
  ({
    id: 'tmp-1',
    product_id: 'p-1',
    product_name: 'Caneca Teste',
    product_sku: 'SKU-1',
    product_image_url: null,
    quantity: 2,
    unit_price: 10,
    color_name: 'Azul',
    color_hex: '#0000ff',
    personalizations: [],
  }) as unknown as QuoteItem;

describe('buildItemsInsertPayload — cor obrigatória', () => {
  it('inclui color_name no payload quando informado', () => {
    const [row] = buildItemsInsertPayload([baseItem()], 'quote-1');
    expect(row.color_name).toBe('Azul');
    expect(row.quote_id).toBe('quote-1');
  });

  it('lança erro quando color_name é null', () => {
    expect(() =>
      buildItemsInsertPayload([baseItem({ color_name: null as unknown as string })], 'q'),
    ).toThrow(/selecione uma cor/i);
  });

  it('lança erro quando color_name é string vazia', () => {
    expect(() => buildItemsInsertPayload([baseItem({ color_name: '' })], 'q')).toThrow(
      /selecione uma cor/i,
    );
  });

  it('lança erro quando color_name é só espaços em branco', () => {
    expect(() => buildItemsInsertPayload([baseItem({ color_name: '   ' })], 'q')).toThrow(
      /selecione uma cor/i,
    );
  });

  it('lista o nome do produto sem cor no erro', () => {
    expect(() =>
      buildItemsInsertPayload(
        [baseItem({ product_name: 'Squeeze Premium', color_name: '' })],
        'q',
      ),
    ).toThrow(/Squeeze Premium/);
  });
});
