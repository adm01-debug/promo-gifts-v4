import { describe, it, expect } from 'vitest';
import { processStockEntries, VariantWithStock } from '../useVariantSupplierSources';

describe('processStockEntries', () => {
  const mockVariant: VariantWithStock = {
    id: 'v1',
    product_id: 'p1',
    sku: 'SKU1',
    color_code: '01',
    color_name: 'Preto',
    color_hex: '#000000',
    stock_quantity: 10,
    selected_thumbnail: 'thumb.jpg',
    next_entry_date: '2026-06-01',
    next_entry_quantity: 100,
    next_date_1: '2026-06-01',
    next_quantity_1: 100,
    next_date_2: '2026-07-01',
    next_quantity_2: 200,
    next_date_3: '2026-08-01',
    next_quantity_3: 300,
  };

  it('deve gerar até 3 entradas para uma variante com todos os dados preenchidos', () => {
    const entries = processStockEntries([mockVariant]);
    expect(entries).toHaveLength(3);
    
    expect(entries[0]).toMatchObject({
      id: 'v1-1',
      variantId: 'v1',
      expectedDate: '2026-06-01',
      expectedQuantity: 100,
      entryIndex: 1
    });

    expect(entries[1]).toMatchObject({
      id: 'v1-2',
      variantId: 'v1',
      expectedDate: '2026-07-01',
      expectedQuantity: 200,
      entryIndex: 2
    });

    expect(entries[2]).toMatchObject({
      id: 'v1-3',
      variantId: 'v1',
      expectedDate: '2026-08-01',
      expectedQuantity: 300,
      entryIndex: 3
    });
  });

  it('deve ignorar entradas com quantidade zero ou nula', () => {
    const variantWithPartialData: VariantWithStock = {
      ...mockVariant,
      next_date_1: '2026-06-01',
      next_quantity_1: 100,
      next_date_2: '2026-07-01',
      next_quantity_2: 0, // Zero - deve ignorar
      next_date_3: '2026-08-01',
      next_quantity_3: 300,
    };

    const entries = processStockEntries([variantWithPartialData]);
    expect(entries).toHaveLength(2); // Deve ter 1 e 3
    
    expect(entries[0].entryIndex).toBe(1);
    expect(entries[1].entryIndex).toBe(3);
  });

  it('deve lidar com variantes sem nenhuma previsão', () => {
    const variantNoData: VariantWithStock = {
      ...mockVariant,
      next_date_1: null,
      next_quantity_1: null,
      next_date_2: null,
      next_quantity_2: null,
      next_date_3: null,
      next_quantity_3: null,
    };

    const entries = processStockEntries([variantNoData]);
    expect(entries).toHaveLength(0);
  });
});
