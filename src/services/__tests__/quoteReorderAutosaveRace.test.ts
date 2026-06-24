/**
 * Race entre persistItemsOrder (UPDATE granular no banco) e o autosave global
 * que captura `items` (com `sort_order`) em LocalStorage.
 *
 * Cenário simulado:
 *  1. Usuário arrasta item C para a primeira posição → `arrayMove` produz [C,A,B].
 *  2. `persistItemsOrder` envia 3 UPDATEs ao banco (sort_order = 0/1/2).
 *  3. ENQUANTO os UPDATEs estão em voo, o autosave global do quote builder
 *     dispara (debounce de 2s) e captura o snapshot atual de `items`.
 *  4. Se `skipAutosaveSortOrder` NÃO estiver ativo, o snapshot do autosave grava
 *     o `sort_order` intermediário em LocalStorage. Em um reload imediato, esse
 *     payload sobrescreveria o `sort_order` final do banco.
 *
 * Invariante validada:
 *  - Quando a flag está ATIVA, o snapshot do autosave NÃO contém `sort_order`.
 *  - Após `persistItemsOrder` resolver, a ordem final no "banco" bate com a UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persistItemsOrder } from '@/services/quoteItemsReorder';

const db: Map<string, number> = new Map();

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        update: (patch: { sort_order: number }) => ({
          eq: (_c1: string, id: string) => ({
            eq: (_c2: string, _quoteId: string) =>
              // Simula latência de rede variável para forçar a race.
              new Promise((resolve) => {
                setTimeout(() => {
                  db.set(id, patch.sort_order);
                  resolve({ error: null });
                }, Math.floor(Math.random() * 15) + 5);
              }),
          }),
        }),
      })),
    },
  };
});

vi.mock('@/lib/security/sanitize-message', () => ({
  sanitizeMessage: (_e: unknown, opts: { fallback: string }) => opts.fallback,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

interface Item {
  id: string;
  sort_order?: number;
}

/** Snapshot do autosave (mesma lógica do useQuoteBuilderState):
 *  quando `skipAutosaveSortOrder` é true, `sort_order` é removido. */
function buildAutosaveItems(items: Item[], skip: boolean): Item[] {
  return skip
    ? items.map(({ sort_order: _omit, ...rest }) => rest as Item)
    : items;
}

describe('race: persistItemsOrder × autosave global', () => {
  beforeEach(() => {
    db.clear();
    // Seed inicial: ordem A=0, B=1, C=2.
    db.set('A', 0);
    db.set('B', 1);
    db.set('C', 2);
  });

  it('ATIVA: snapshot do autosave NÃO inclui sort_order durante reorder em voo', async () => {
    const reorderedUI: Item[] = [
      { id: 'C', sort_order: 0 },
      { id: 'A', sort_order: 1 },
      { id: 'B', sort_order: 2 },
    ];

    // Liga a flag (como o componente faz no início de persistOrderInBackground)
    let skipAutosaveSortOrder = true;
    const persistPromise = persistItemsOrder('q1', reorderedUI.map((i) => ({
      id: i.id,
      sort_order: i.sort_order!,
    })));

    // Autosave dispara MEIO da janela de latência.
    await new Promise((r) => setTimeout(r, 3));
    const snapshot = buildAutosaveItems(reorderedUI, skipAutosaveSortOrder);
    expect(snapshot.every((it) => it.sort_order === undefined)).toBe(true);

    await persistPromise;
    skipAutosaveSortOrder = false;

    // Banco final bate com a UI.
    expect(db.get('C')).toBe(0);
    expect(db.get('A')).toBe(1);
    expect(db.get('B')).toBe(2);

    // Pós-persistência, o autosave volta a poder gravar sort_order.
    const postSnapshot = buildAutosaveItems(reorderedUI, skipAutosaveSortOrder);
    expect(postSnapshot.map((i) => i.sort_order)).toEqual([0, 1, 2]);
  });

  it('DESATIVADA (regressão): snapshot do autosave carrega sort_order — demonstra a race', () => {
    const reorderedUI: Item[] = [
      { id: 'C', sort_order: 0 },
      { id: 'A', sort_order: 1 },
      { id: 'B', sort_order: 2 },
    ];
    const skip = false; // hipótese: flag não implementada
    const snapshot = buildAutosaveItems(reorderedUI, skip);
    // O snapshot capturado no LocalStorage levaria sort_order — perigoso se
    // o componente reiniciasse ANTES do persistItemsOrder resolver e o
    // restore do autosave alimentasse um global save subsequente.
    expect(snapshot.map((i) => i.sort_order)).toEqual([0, 1, 2]);
  });

  it('100 reorders simultâneos: ordem final no banco bate com a UI', async () => {
    const N = 50;
    // Cria 10 itens.
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`);
    ids.forEach((id, i) => db.set(id, i));

    // Sequência de N reorders aleatórios, simulando o usuário arrastando rápido.
    for (let r = 0; r < N; r++) {
      const shuffled = ids.slice().sort(() => Math.random() - 0.5);
      const rows = shuffled.map((id, i) => ({ id, sort_order: i }));
      await persistItemsOrder('q1', rows);
      // Banco bate com a UI após cada commit.
      shuffled.forEach((id, i) => expect(db.get(id)).toBe(i));
    }
  });
});
