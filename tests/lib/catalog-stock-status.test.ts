import { describe, it, expect } from 'vitest';
import {
  getCatalogStockStatus,
  getCatalogStockStatusLabel,
  getCatalogStockStatusColor,
  CATALOG_LOW_STOCK_THRESHOLD,
  CATALOG_STOCK_STATUS_LABEL,
  type CatalogStockStatus,
} from '@/lib/catalog-stock-status';

describe('getCatalogStockStatus — fronteiras do limiar padrão (10)', () => {
  const cases: Array<[number, CatalogStockStatus]> = [
    [-100, 'out-of-stock'],
    [-1, 'out-of-stock'],
    [0, 'out-of-stock'],
    [1, 'low-stock'],
    [5, 'low-stock'],
    [9, 'low-stock'],
    [9.99, 'low-stock'],
    [10, 'in-stock'],
    [10.01, 'in-stock'],
    [11, 'in-stock'],
    [100, 'in-stock'],
    [1_000_000, 'in-stock'],
  ];
  it.each(cases)('stock=%s => %s', (stock, expected) => {
    expect(getCatalogStockStatus(stock)).toBe(expected);
  });
});

describe('getCatalogStockStatus — entradas anômalas normalizam para out-of-stock', () => {
  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['null', null],
    ['undefined', undefined],
  ])('%s => out-of-stock', (_label, value) => {
    expect(getCatalogStockStatus(value as number)).toBe('out-of-stock');
  });

  it('-0 => out-of-stock', () => {
    expect(getCatalogStockStatus(-0)).toBe('out-of-stock');
  });
});

describe('getCatalogStockStatus — limiar de low-stock customizado (2º arg)', () => {
  it('respeita threshold=1 (apenas 0 e abaixo são out)', () => {
    expect(getCatalogStockStatus(1, 1)).toBe('in-stock');
    expect(getCatalogStockStatus(0, 1)).toBe('out-of-stock');
  });
  it('respeita threshold=100', () => {
    expect(getCatalogStockStatus(99, 100)).toBe('low-stock');
    expect(getCatalogStockStatus(100, 100)).toBe('in-stock');
  });
  it('threshold padrão é 10', () => {
    expect(CATALOG_LOW_STOCK_THRESHOLD).toBe(10);
  });
});

describe('getCatalogStockStatus — order-gate por min_quantity (3º arg)', () => {
  // BUG-STOCK-01 consolidado: estoque positivo abaixo do mínimo pedível do
  // fornecedor = out-of-stock (não pode ser pedido), mesmo acima do limiar de low-stock.
  it('estoque > 0 mas abaixo do mínimo pedível => out-of-stock', () => {
    expect(getCatalogStockStatus(5, undefined, 20)).toBe('out-of-stock');
    expect(getCatalogStockStatus(19, undefined, 20)).toBe('out-of-stock');
    // 50 unidades em estoque mas mínimo 100 → não pedível
    expect(getCatalogStockStatus(50, undefined, 100)).toBe('out-of-stock');
  });
  it('estoque >= mínimo pedível mantém a classificação normal de low/in-stock', () => {
    expect(getCatalogStockStatus(20, undefined, 20)).toBe('in-stock'); // 20 >= limiar 10
    expect(getCatalogStockStatus(8, undefined, 5)).toBe('low-stock'); // 8 >= min 5, mas < 10
    expect(getCatalogStockStatus(100, undefined, 100)).toBe('in-stock');
  });
  it('min_quantity ausente/0/null/<1 não bloqueia (sem gate)', () => {
    expect(getCatalogStockStatus(5, undefined, undefined)).toBe('low-stock');
    expect(getCatalogStockStatus(5, undefined, null)).toBe('low-stock');
    expect(getCatalogStockStatus(5, undefined, 0)).toBe('low-stock');
    expect(getCatalogStockStatus(5, undefined, 0.5)).toBe('low-stock');
  });
  it('min_quantity não-finito é ignorado (sem gate)', () => {
    expect(getCatalogStockStatus(5, undefined, NaN)).toBe('low-stock');
    expect(getCatalogStockStatus(5, undefined, Infinity)).toBe('low-stock');
  });
  it('estoque zerado continua out-of-stock independentemente do min', () => {
    expect(getCatalogStockStatus(0, undefined, 20)).toBe('out-of-stock');
    expect(getCatalogStockStatus(0, undefined, 0)).toBe('out-of-stock');
  });
});

describe('Invariante de monotonicidade — status nunca melhora ao reduzir estoque', () => {
  it('varre 0..1000 garantindo ordem out <= low <= in', () => {
    const rank: Record<CatalogStockStatus, number> = {
      'out-of-stock': 0,
      'low-stock': 1,
      'in-stock': 2,
    };
    let prev = -1;
    for (let stock = 0; stock <= 1000; stock++) {
      const r = rank[getCatalogStockStatus(stock)];
      expect(r).toBeGreaterThanOrEqual(prev); // monotônico não-decrescente
      prev = r;
    }
  });

  it('para qualquer threshold T, T-1 é low e T é in (varredura de thresholds)', () => {
    for (const T of [1, 2, 5, 10, 25, 50, 100, 500]) {
      expect(getCatalogStockStatus(T - 1, T)).toBe(T - 1 <= 0 ? 'out-of-stock' : 'low-stock');
      expect(getCatalogStockStatus(T, T)).toBe('in-stock');
    }
  });
});

describe('Rótulos e cores canônicos', () => {
  it('mapeia os 3 estados para pt-BR', () => {
    expect(getCatalogStockStatusLabel('in-stock')).toBe('Em estoque');
    expect(getCatalogStockStatusLabel('low-stock')).toBe('Estoque baixo');
    expect(getCatalogStockStatusLabel('out-of-stock')).toBe('Estoque zerado');
  });
  it('fallback para "Em estoque" em status desconhecido', () => {
    expect(getCatalogStockStatusLabel('qualquer-coisa')).toBe('Em estoque');
    expect(getCatalogStockStatusLabel('')).toBe('Em estoque');
  });
  it('cor usa o próprio identificador, com fallback in-stock', () => {
    expect(getCatalogStockStatusColor('low-stock')).toBe('low-stock');
    expect(getCatalogStockStatusColor('desconhecido')).toBe('in-stock');
  });
  it('o mapa de labels cobre exatamente os 3 estados', () => {
    expect(Object.keys(CATALOG_STOCK_STATUS_LABEL).sort()).toEqual(
      ['in-stock', 'low-stock', 'out-of-stock'].sort(),
    );
  });
});
