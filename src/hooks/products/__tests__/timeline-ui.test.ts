/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { processStockEntries } from '../useVariantSupplierSources';

describe('useVariantSupplierSources UI Logic / Timeline', () => {
  it('deve gerar entradas válidas e ignorar pares vazios ou com quantidade zero', () => {
    const mockVariants = [
      {
        id: 'v1',
        product_id: 'p1',
        sku: 'SKU-01',
        color_name: 'Azul',
        color_code: 'blue',
        color_hex: '#0000FF',
        stock_quantity: 10,
        selected_thumbnail: 'thumb1.jpg',
        next_date_1: '2026-06-10',
        next_quantity_1: 50,
        next_date_2: '2026-07-15',
        next_quantity_2: 0, // Deve ignorar
        next_date_3: null, // Deve ignorar
        next_quantity_3: 100, // Deve ignorar porque a data é nula
      },
    ];

    const entries = processStockEntries(mockVariants as any);

    expect(entries).toHaveLength(1);
    expect(entries[0].expectedDate).toBe('2026-06-10');
    expect(entries[0].expectedQuantity).toBe(50);
    expect(entries[0].entryIndex).toBe(1);
  });

  it('deve manter a consistência de IDs e entryIndex para múltiplas chegadas válidas', () => {
    const mockVariants = [
      {
        id: 'v1',
        product_id: 'p1',
        sku: 'SKU-01',
        color_name: 'Azul',
        next_date_1: '2026-06-10',
        next_quantity_1: 50,
        next_date_2: '2026-07-15',
        next_quantity_2: 30,
        next_date_3: '2026-08-20',
        next_quantity_3: 20,
      },
    ];

    const entries = processStockEntries(mockVariants as any);

    expect(entries).toHaveLength(3);
    expect(entries[0].id).toBe('v1-1');
    expect(entries[0].entryIndex).toBe(1);
    expect(entries[1].id).toBe('v1-2');
    expect(entries[1].entryIndex).toBe(2);
    expect(entries[2].id).toBe('v1-3');
    expect(entries[2].entryIndex).toBe(3);
  });

  it('deve permitir ordenação cronológica correta das entradas processadas', () => {
    const mockVariants = [
      {
        id: 'v1',
        product_id: 'p1',
        sku: 'SKU-01',
        color_name: 'Azul',
        next_date_1: '2026-08-10',
        next_quantity_1: 50,
        next_date_2: '2026-06-15',
        next_quantity_2: 30,
      },
    ];

    const entries = processStockEntries(mockVariants as any);

    // Simula a ordenação que acontece no componente
    const sorted = [...entries].sort(
      (a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime(),
    );

    expect(sorted[0].expectedDate).toBe('2026-06-15');
    expect(sorted[1].expectedDate).toBe('2026-08-10');
  });
});
