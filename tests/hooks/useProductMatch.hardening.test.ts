/**
 * Regressão do hardening da engine de match (auditoria adversarial 2026-06-25):
 *  - Dedup do lado SOURCE: valores repetidos no MESMO produto (dados sujos de fornecedor)
 *    não devem inflar o score. O lado candidato já vira Set; o source era percorrido como
 *    array em .filter(), então duplicatas contavam várias vezes (tag +20, material +18 SEM teto).
 *  - calculateMatchScore expõe `hasComplementary` estruturado (o hook não depende mais de
 *    parsear a string de exibição "Complementar:").
 */
import { describe, it, expect } from 'vitest';
import { calculateMatchScore } from '@/hooks/products/useProductMatch';
import type { Product } from '@/types/product-catalog';

const mk = (o: Record<string, unknown>): Product =>
  ({ id: 'x', name: 'X', tags: {}, ...o } as unknown as Product);

describe('hardening — dedup do lado source (robustez a dados sujos)', () => {
  it('tag duplicada no mesmo produto conta 1× (10, não 20)', () => {
    const s = mk({ id: '1', name: 'A', tags: { publicoAlvo: ['Jovem', 'Jovem'] } });
    const c = mk({ id: '2', name: 'B', tags: { publicoAlvo: ['jovem'] }, category_id: 'z' });
    expect(calculateMatchScore(s, c).score).toBe(10);
  });

  it('mesmo termo em nicho E ramo do source conta 1× (15, não 30)', () => {
    const s = mk({ id: '1', name: 'A', tags: { nicho: ['Tech'], ramo: ['tech'] } });
    const c = mk({ id: '2', name: 'B', tags: { nicho: ['tech'] }, category_id: 'z' });
    expect(calculateMatchScore(s, c).score).toBe(15);
  });

  it('descritor duplicado conta 1× (8, não 16)', () => {
    const s = mk({ id: '1', name: 'A', descriptiveTags: ['eco', 'eco'] });
    const c = mk({ id: '2', name: 'B', descriptiveTags: ['eco'], category_id: 'z' });
    expect(calculateMatchScore(s, c).score).toBe(8);
  });

  it('material duplicado conta 1× — regra SEM teto, era a pior inflação (6, não 18)', () => {
    const s = mk({ id: '1', name: 'A', materials: ['Inox', 'inox', 'INOX'] });
    const c = mk({ id: '2', name: 'B', materials: ['inox'], category_id: 'z' });
    expect(calculateMatchScore(s, c).score).toBe(6);
  });

  it('duplicatas em vários campos == versão limpa (idempotência de dados sujos)', () => {
    const dirty = mk({ id: '1', name: 'Caneta', category_id: 'c1',
      tags: { publicoAlvo: ['Jovem', 'Jovem'], nicho: ['Tech'], ramo: ['Tech'] },
      descriptiveTags: ['eco', 'eco'], materials: ['inox', 'inox'], supplier: { id: 's1', name: 'S' } });
    const clean = mk({ id: '1', name: 'Caneta', category_id: 'c1',
      tags: { publicoAlvo: ['Jovem'], nicho: ['Tech'] },
      descriptiveTags: ['eco'], materials: ['inox'], supplier: { id: 's1', name: 'S' } });
    const cand = mk({ id: '2', name: 'Caderno Capa Dura', category_id: 'c1',
      tags: { publicoAlvo: ['jovem'], nicho: ['tech'] },
      descriptiveTags: ['eco'], materials: ['inox'], supplier: { id: 's1', name: 'S' } });
    expect(calculateMatchScore(dirty, cand).score).toBe(calculateMatchScore(clean, cand).score);
  });
});

describe('hardening — calculateMatchScore expõe hasComplementary estruturado', () => {
  it('true e consistente com reasons quando há complementar', () => {
    const r = calculateMatchScore(mk({ id: '1', name: 'Caneta' }), mk({ id: '2', name: 'Caderno Capa Dura', category_id: 'z' }));
    expect(r.hasComplementary).toBe(true);
    expect(r.hasComplementary).toBe(r.reasons.some((x) => x.startsWith('Complementar')));
  });

  it('false e consistente com reasons quando não há complementar', () => {
    const r = calculateMatchScore(mk({ id: '1', name: 'Caneta Azul', category_id: 'c1' }), mk({ id: '2', name: 'Caneta Vermelha', category_id: 'c1' }));
    expect(r.hasComplementary).toBe(false);
    expect(r.hasComplementary).toBe(r.reasons.some((x) => x.startsWith('Complementar')));
  });
});
