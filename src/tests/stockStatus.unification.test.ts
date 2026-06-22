import { describe, it, expect } from 'vitest';
import { getStockStatus } from '@/components/inventory/StockBadge';
import { getCatalogStockStatus } from '@/lib/catalog-stock-status';

// Guarda a unificação (F1+F2): o status por cor da Reposição passou a usar
// getCatalogStockStatus (mesma função de Novidades). Se alguém reverter para
// getStockStatus(.,10), as divergências em qty=10 e negativos reaparecem e
// este teste falha.
describe('Status por cor — unificação cross-módulo (getCatalogStockStatus)', () => {
  it('caracteriza TODAS as divergências getStockStatus(.,10) × getCatalogStockStatus (-50..1000)', () => {
    const diffs: Array<{ q: number; oldS: string; neu: string }> = [];
    for (let q = -50; q <= 1000; q++) {
      const oldS = getStockStatus(q, 10);
      const neu = getCatalogStockStatus(q);
      if (oldS !== neu) diffs.push({ q, oldS, neu });
    }
    const diffQs = diffs.map((d) => d.q);
    for (let q = -50; q < 0; q++) expect(diffQs).toContain(q);
    expect(diffQs).toContain(10);
    expect(diffQs).not.toContain(0);
    for (let q = 1; q <= 9; q++) expect(diffQs).not.toContain(q);
    for (let q = 11; q <= 1000; q++) expect(diffQs).not.toContain(q);
    expect(diffs.length).toBe(51); // 50 negativos + q=10
    expect(getCatalogStockStatus(10)).toBe('in-stock');
    expect(getCatalogStockStatus(-5)).toBe('out-of-stock');
  });

  it('convenção adotada: qty>=10 in-stock, 1..9 low-stock, <=0 out-of-stock', () => {
    expect(getCatalogStockStatus(0)).toBe('out-of-stock');
    expect(getCatalogStockStatus(9)).toBe('low-stock');
    expect(getCatalogStockStatus(10)).toBe('in-stock');
    expect(getCatalogStockStatus(-1)).toBe('out-of-stock');
    expect(getCatalogStockStatus(50)).toBe('in-stock');
  });
});
