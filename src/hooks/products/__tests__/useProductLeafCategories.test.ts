import { describe, it, expect } from 'vitest';
import { pickLeaves } from '../useProductLeafCategories';

// Metadados de categoria reusando o shape interno (id, name, level, parent_id).
type CatRow = { id: string; name: string; level: number | null; parent_id: string | null };

function catMap(rows: CatRow[]): Map<string, CatRow> {
  return new Map(rows.map((r) => [r.id, r]));
}

// Árvore: Raiz(1) › Meio(2) › Folha(3) e uma segunda folha SemPauta(3)
const TREE: CatRow[] = [
  { id: 'root', name: 'Cadernetas', level: 1, parent_id: null },
  { id: 'mid', name: 'Capa Dura', level: 2, parent_id: 'root' },
  { id: 'leafA', name: 'Com Pauta', level: 3, parent_id: 'mid' },
  { id: 'leafB', name: 'Sem Pauta', level: 3, parent_id: 'mid' },
];

describe('pickLeaves — escolha da categoria-folha', () => {
  it('escolhe o assignment de MAIOR level (folha mais profunda), não a raiz', () => {
    const assignments = [
      { product_id: 'p1', category_id: 'root', is_primary: true, display_order: 0 },
      { product_id: 'p1', category_id: 'leafA', is_primary: false, display_order: 5 },
    ];
    const leaves = pickLeaves(assignments, catMap(TREE));
    expect(leaves.get('p1')?.id).toBe('leafA');
    expect(leaves.get('p1')?.level).toBe(3);
  });

  it('monta o caminho raiz→folha completo', () => {
    const assignments = [
      { product_id: 'p1', category_id: 'leafA', is_primary: true, display_order: 0 },
    ];
    const leaves = pickLeaves(assignments, catMap(TREE));
    expect(leaves.get('p1')?.path).toEqual(['Cadernetas', 'Capa Dura', 'Com Pauta']);
  });

  it('empate de nível: desempata por is_primary=true', () => {
    const assignments = [
      { product_id: 'p1', category_id: 'leafA', is_primary: false, display_order: 1 },
      { product_id: 'p1', category_id: 'leafB', is_primary: true, display_order: 9 },
    ];
    const leaves = pickLeaves(assignments, catMap(TREE));
    expect(leaves.get('p1')?.id).toBe('leafB'); // primary vence apesar de display_order maior
  });

  it('empate de nível sem primary: desempata por menor display_order', () => {
    const assignments = [
      { product_id: 'p1', category_id: 'leafA', is_primary: false, display_order: 7 },
      { product_id: 'p1', category_id: 'leafB', is_primary: false, display_order: 2 },
    ];
    const leaves = pickLeaves(assignments, catMap(TREE));
    expect(leaves.get('p1')?.id).toBe('leafB');
  });

  it('empate total: desempata por nome (alfabético)', () => {
    const assignments = [
      { product_id: 'p1', category_id: 'leafA', is_primary: false, display_order: null },
      { product_id: 'p1', category_id: 'leafB', is_primary: false, display_order: null },
    ];
    const leaves = pickLeaves(assignments, catMap(TREE));
    // 'Com Pauta' < 'Sem Pauta' → leafA
    expect(leaves.get('p1')?.id).toBe('leafA');
  });

  it('ignora assignment cuja categoria não tem metadados (sem quebrar)', () => {
    const assignments = [
      { product_id: 'p1', category_id: 'ghost', is_primary: true, display_order: 0 },
      { product_id: 'p1', category_id: 'mid', is_primary: false, display_order: 0 },
    ];
    const leaves = pickLeaves(assignments, catMap(TREE));
    expect(leaves.get('p1')?.id).toBe('mid');
  });

  it('produto sem nenhuma categoria conhecida não entra no resultado', () => {
    const assignments = [
      { product_id: 'p1', category_id: 'ghost', is_primary: true, display_order: 0 },
    ];
    const leaves = pickLeaves(assignments, catMap(TREE));
    expect(leaves.has('p1')).toBe(false);
  });

  it('resolve múltiplos produtos independentemente', () => {
    const assignments = [
      { product_id: 'p1', category_id: 'leafA', is_primary: true, display_order: 0 },
      { product_id: 'p2', category_id: 'mid', is_primary: true, display_order: 0 },
    ];
    const leaves = pickLeaves(assignments, catMap(TREE));
    expect(leaves.get('p1')?.id).toBe('leafA');
    expect(leaves.get('p2')?.id).toBe('mid');
  });
});
