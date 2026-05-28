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

  it('deve ignorar pares vazios, zero ou nulos (data ou quantidade)', () => {
    const variantWithEdgeCases: VariantWithStock = {
      ...mockVariant,
      next_date_1: '2026-06-01',
      next_quantity_1: 0, // Zero - deve ignorar
      next_date_2: null, // Data nula - deve ignorar
      next_quantity_2: 100,
      next_date_3: '2026-08-01',
      next_quantity_3: -10, // Negativa - deve ignorar
    };

    const entries = processStockEntries([variantWithEdgeCases]);
    expect(entries).toHaveLength(0);

    const variantWithOneValid: VariantWithStock = {
      ...mockVariant,
      next_date_1: '2026-06-01',
      next_quantity_1: 10,
      next_date_2: '', // Data vazia
      next_quantity_2: 20,
      next_date_3: null, // Limpar para ter apenas 1 válida
      next_quantity_3: null,
    };
    const entries2 = processStockEntries([variantWithOneValid]);
    expect(entries2).toHaveLength(1);
    expect(entries2[0].expectedDate).toBe('2026-06-01');
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

  it('deve garantir que o entryIndex e os IDs sejam consistentes para 3 chegadas', () => {
    const variant: VariantWithStock = {
      ...mockVariant,
      id: 'var-999',
      next_date_1: '2026-01-01',
      next_quantity_1: 10,
      next_date_2: '2026-02-01',
      next_quantity_2: 20,
      next_date_3: '2026-03-01',
      next_quantity_3: 30,
    };

    const entries = processStockEntries([variant]);
    expect(entries[0].id).toBe('var-999-1');
    expect(entries[0].entryIndex).toBe(1);
    expect(entries[1].id).toBe('var-999-2');
    expect(entries[1].entryIndex).toBe(2);
    expect(entries[2].id).toBe('var-999-3');
    expect(entries[2].entryIndex).toBe(3);
  });

  it('deve ignorar pares onde a data é nula mas a quantidade existe', () => {
    const variant: VariantWithStock = {
      id: 'v-null-date',
      product_id: 'p1',
      sku: 'S1',
      color_code: '01',
      color_name: 'Cor',
      color_hex: '#000',
      stock_quantity: 0,
      selected_thumbnail: null,
      next_date_1: null,
      next_quantity_1: 100,
      next_date_2: '2026-01-01',
      next_quantity_2: 200,
      next_date_3: null,
      next_quantity_3: null,
    };

    const entries = processStockEntries([variant]);
    expect(entries).toHaveLength(1);
    expect(entries[0].expectedQuantity).toBe(200);
  });

  it('deve manter o entryIndex correto mesmo quando entradas anteriores são vazias', () => {
    const variant: VariantWithStock = {
      id: 'v-only-2',
      product_id: 'p1',
      sku: 'S1',
      color_code: '01',
      color_name: 'Cor',
      color_hex: '#000',
      stock_quantity: 0,
      selected_thumbnail: null,
      next_date_1: null,
      next_quantity_1: null,
      next_date_2: '2026-02-01',
      next_quantity_2: 500,
      next_date_3: null,
      next_quantity_3: null,
    };

    const entries = processStockEntries([variant]);
    expect(entries).toHaveLength(1);
    expect(entries[0].entryIndex).toBe(2);
    expect(entries[0].id).toBe('v-only-2-2');
  });
});
