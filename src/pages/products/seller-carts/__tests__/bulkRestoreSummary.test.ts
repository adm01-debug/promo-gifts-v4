/**
 * bulkRestoreSummary — cobertura da copy do toast após restauração em lote.
 *
 * Casos:
 *  A) Sucesso total (singular e plural)
 *  B) Falha parcial (mostra restaurados vs. falhas)
 *  C) Falha total (singular e plural)
 *  D) Edge: `attempted = 0` → falha total plural (defensivo)
 */
import { describe, it, expect } from 'vitest';
import { bulkRestoreSummary } from '../bulkRestoreSummary';

describe('bulkRestoreSummary — copy do toast', () => {
  it('A1) sucesso total singular', () => {
    expect(bulkRestoreSummary(1, 1)).toEqual({
      tone: 'success',
      message: 'Carrinho restaurado.',
    });
  });

  it('A2) sucesso total plural', () => {
    expect(bulkRestoreSummary(5, 5)).toEqual({
      tone: 'success',
      message: '5 carrinhos restaurados.',
    });
  });

  it('B1) falha parcial: 3 tentados, 2 restaurados', () => {
    expect(bulkRestoreSummary(3, 2)).toEqual({
      tone: 'warning',
      message: '2 restaurado(s), 1 falhou(aram).',
    });
  });

  it('B2) falha parcial: 10 tentados, 1 restaurado', () => {
    expect(bulkRestoreSummary(10, 1)).toEqual({
      tone: 'warning',
      message: '1 restaurado(s), 9 falhou(aram).',
    });
  });

  it('C1) falha total singular', () => {
    expect(bulkRestoreSummary(1, 0)).toEqual({
      tone: 'error',
      message: 'Não foi possível restaurar o carrinho.',
    });
  });

  it('C2) falha total plural', () => {
    expect(bulkRestoreSummary(4, 0)).toEqual({
      tone: 'error',
      message: 'Não foi possível restaurar os carrinhos.',
    });
  });

  it('D) attempted=0 é tratado como falha total plural (defensivo)', () => {
    const s = bulkRestoreSummary(0, 0);
    expect(s.tone).toBe('error');
    expect(s.message).toMatch(/Não foi possível/);
  });

  it('nunca reporta "restaurados" quando restored=0', () => {
    for (let n = 1; n <= 20; n++) {
      const s = bulkRestoreSummary(n, 0);
      expect(s.tone).toBe('error');
      expect(s.message).not.toMatch(/restaurado/);
    }
  });
});
