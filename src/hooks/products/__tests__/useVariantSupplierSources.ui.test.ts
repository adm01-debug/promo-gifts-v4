import { describe, it, expect } from 'vitest';
import { processStockEntries, type VariantWithStock } from '../useVariantSupplierSources';

describe('useVariantSupplierSources - Partial Mapping & UI Logic', () => {
  it('deve mapear corretamente combinações parciais com campos nulos', () => {
    const variant: VariantWithStock = {
      id: 'v1',
      product_id: 'p1',
      sku: 'SKU1',
      color_code: '01',
      color_name: 'Azul',
      color_hex: '#0000FF',
      stock_quantity: 5,
      selected_thumbnail: null,
      next_entry_date: null,
      next_entry_quantity: null,
      next_date_1: '2026-10-10',
      next_quantity_1: 100,
      next_date_2: null,
      next_quantity_2: 200,
      next_date_3: '2026-12-12',
      next_quantity_3: null,
    };

    const entries = processStockEntries([variant]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      expectedDate: '2026-10-10',
      expectedQuantity: 100,
      entryIndex: 1,
    });
  });

  it('deve ignorar pares com quantidade zero mesmo se a data existir', () => {
    const variant: VariantWithStock = {
      id: 'v2',
      product_id: 'p1',
      sku: 'SKU2',
      color_code: '02',
      color_name: 'Verde',
      color_hex: '#00FF00',
      stock_quantity: 0,
      selected_thumbnail: null,
      next_entry_date: null,
      next_entry_quantity: null,
      next_date_1: '2026-11-11',
      next_quantity_1: 0,
      next_date_2: '2026-12-12',
      next_quantity_2: 50,
    };

    const entries = processStockEntries([variant]);
    expect(entries).toHaveLength(1);
    expect(entries[0].expectedQuantity).toBe(50);
    expect(entries[0].entryIndex).toBe(2);
  });
});
