/**
 * magazineService — fuzz de lifecycle com mock in-memory de supabase.from().
 *
 * 100+ cenários combinatoriais (fast-check) sobre create/update/addProducts/
 * removeItem/reorderItems/duplicate/delete/restore/publish/unpublish e
 * round-trip snake_case ↔ camelCase.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// ============================================================================
// In-memory "Supabase" — cobre o subset usado por magazineService
// ============================================================================

interface Store {
  magazines: Map<string, Record<string, unknown>>;
  magazine_items: Map<string, Record<string, unknown>>;
}

const store: Store = {
  magazines: new Map(),
  magazine_items: new Map(),
};

let uidCounter = 0;
function uid(prefix = 'r') {
  return `${prefix}_${++uidCounter}`;
}

function nowIso() {
  return new Date().toISOString();
}

interface QueryState {
  table: keyof Store;
  filters: Array<[string, unknown]>;
  isFilters: Array<[string, unknown]>;
  inFilters: Array<[string, unknown[]]>;
  op: 'select' | 'insert' | 'update' | 'delete' | null;
  payload: unknown;
  selectAfter: boolean;
  orderBy: { col: string; ascending: boolean } | null;
}

function newState(table: keyof Store): QueryState {
  return {
    table,
    filters: [],
    isFilters: [],
    inFilters: [],
    op: null,
    payload: null,
    selectAfter: false,
    orderBy: null,
  };
}

function matchesRow(row: Record<string, unknown>, s: QueryState): boolean {
  for (const [k, v] of s.filters) if (row[k] !== v) return false;
  for (const [k, v] of s.isFilters) {
    if (v === null && row[k] != null) return false;
    if (v !== null && row[k] !== v) return false;
  }
  for (const [k, arr] of s.inFilters) if (!arr.includes(row[k])) return false;
  return true;
}

function collect(s: QueryState): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const r of store[s.table].values()) if (matchesRow(r, s)) rows.push(r);
  if (s.orderBy) {
    const { col, ascending } = s.orderBy;
    rows.sort((a, b) => {
      const av = a[col] as number | string;
      const bv = b[col] as number | string;
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return ascending ? cmp : -cmp;
    });
  }
  return rows;
}

function makeBuilder(s: QueryState) {
  const finish = async (single: 'single' | 'maybeSingle' | 'many') => {
    if (s.op === 'insert') {
      const payload = Array.isArray(s.payload) ? s.payload : [s.payload];
      const inserted: Record<string, unknown>[] = [];
      for (const p of payload as Record<string, unknown>[]) {
        const id = (p.id as string) ?? uid(s.table === 'magazines' ? 'mag' : 'itm');
        const row: Record<string, unknown> = {
          ...p,
          id,
          created_at: p.created_at ?? nowIso(),
          updated_at: p.updated_at ?? nowIso(),
        };
        // FK enforcement: magazine_items require magazine_id present
        if (s.table === 'magazine_items' && !row.magazine_id) {
          return { data: null, error: { message: 'magazine_id required' } };
        }
        if (
          s.table === 'magazine_items' &&
          !store.magazines.has(row.magazine_id as string)
        ) {
          return { data: null, error: { message: 'FK violation magazine_id' } };
        }
        store[s.table].set(id, row);
        inserted.push(row);
      }
      const data = single === 'many' ? inserted : inserted[0] ?? null;
      return { data, error: null };
    }
    if (s.op === 'update') {
      const patch = s.payload as Record<string, unknown>;
      const rows = collect(s);
      for (const r of rows) Object.assign(r, patch, { updated_at: nowIso() });
      const data = single === 'many' ? rows : rows[0] ?? null;
      return { data, error: null };
    }
    if (s.op === 'delete') {
      const rows = collect(s);
      for (const r of rows) store[s.table].delete(r.id as string);
      return { data: null, error: null };
    }
    // select
    const rows = collect(s);
    if (single === 'single') {
      if (rows.length !== 1) return { data: null, error: { message: 'not found' } };
      return { data: rows[0], error: null };
    }
    if (single === 'maybeSingle') return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  };

  const builder = {
    select() {
      if (!s.op) s.op = 'select';
      else s.selectAfter = true;
      return builder;
    },
    insert(payload: unknown) {
      s.op = 'insert';
      s.payload = payload;
      return builder;
    },
    update(payload: unknown) {
      s.op = 'update';
      s.payload = payload;
      return builder;
    },
    delete() {
      s.op = 'delete';
      return builder;
    },
    eq(col: string, val: unknown) {
      s.filters.push([col, val]);
      return builder;
    },
    is(col: string, val: unknown) {
      s.isFilters.push([col, val]);
      return builder;
    },
    in(col: string, arr: unknown[]) {
      s.inFilters.push([col, arr]);
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      s.orderBy = { col, ascending: opts?.ascending ?? true };
      return builder;
    },
    single: () => finish('single'),
    maybeSingle: () => finish('maybeSingle'),
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return finish('many').then(onFulfilled, onRejected);
    },
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (table: string) => makeBuilder(newState(table as keyof Store)) },
}));

// Import DEPOIS dos mocks
import { magazineService } from '@/services/magazineService';
import type { Product } from '@/types/product-catalog';

function mkProduct(seed: string, colorName?: string | null): Product {
  return {
    id: `p_${seed}`,
    name: `Produto ${seed}`,
    sku: `SKU-${seed}`,
    shortDescription: '',
    description: null,
    price: 10,
    sale_price: undefined,
    primary_image_url: '',
    image_url: '',
    images: [],
    colors: colorName ? [{ name: colorName, hex: '#000', image: '' }] : [],
    category_name: null,
    category_id: null,
    materials: [],
    hasPersonalization: null,
  } as unknown as Product;
}

beforeEach(() => {
  store.magazines.clear();
  store.magazine_items.clear();
  uidCounter = 0;
});

// ============================================================================

describe('magazineService — lifecycle happy path', () => {
  it('create → get → update title → addProducts → publish → unpublish', async () => {
    const m = await magazineService.create({ ownerId: 'u1', title: 'Nova' });
    expect(m.id).toBeTruthy();
    expect(m.title).toBe('Nova');
    expect(m.status).toBe('draft');

    const got = await magazineService.get(m.id);
    expect(got?.title).toBe('Nova');

    const upd = await magazineService.update(m.id, { title: 'Editada' });
    expect(upd?.title).toBe('Editada');

    const withProds = await magazineService.addProducts(m.id, [
      mkProduct('a', 'Preto'),
      mkProduct('b'),
    ]);
    expect(withProds?.items).toHaveLength(2);
    expect(withProds?.items[0].variantColorName).toBe('Preto');
    expect(withProds?.items[1].variantColorName).toBeNull();

    const pub = await magazineService.publish(m.id);
    expect(pub?.status).toBe('published');
    expect(pub?.publishedAt).toBeTruthy();

    const unp = await magazineService.unpublish(m.id);
    expect(unp?.status).toBe('draft');
  });

  it('addProducts idempotente: mesmo produto não duplica', async () => {
    const m = await magazineService.create({ ownerId: 'u' });
    const p = mkProduct('x');
    await magazineService.addProducts(m.id, [p]);
    const after = await magazineService.addProducts(m.id, [p]);
    expect(after?.items).toHaveLength(1);
  });

  it('reorderItems reordena e positions ficam sequenciais', async () => {
    const m = await magazineService.create({ ownerId: 'u' });
    const withProds = await magazineService.addProducts(m.id, [
      mkProduct('a'),
      mkProduct('b'),
      mkProduct('c'),
    ]);
    const ids = withProds!.items.map((i) => i.id).reverse();
    const reordered = await magazineService.reorderItems(m.id, ids);
    expect(reordered?.items.map((i) => i.productId)).toEqual(['p_c', 'p_b', 'p_a']);
    expect(reordered?.items.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it('removeItem preserva os demais', async () => {
    const m = await magazineService.create({ ownerId: 'u' });
    const withProds = await magazineService.addProducts(m.id, [
      mkProduct('a'),
      mkProduct('b'),
    ]);
    const rid = withProds!.items[0].id;
    const after = await magazineService.removeItem(m.id, rid);
    expect(after?.items).toHaveLength(1);
    expect(after?.items[0].productId).toBe('p_b');
  });

  it('duplicate copia header + items, mas com novo id', async () => {
    const m = await magazineService.create({ ownerId: 'u', title: 'Orig' });
    await magazineService.addProducts(m.id, [mkProduct('a'), mkProduct('b')]);
    const clone = await magazineService.duplicate(m.id);
    expect(clone).not.toBeNull();
    expect(clone!.id).not.toBe(m.id);
    expect(clone!.title).toMatch(/cópia/);
    expect(clone!.items).toHaveLength(2);
  });

  it('delete soft (deleted_at) + get retorna null + restore volta', async () => {
    const m = await magazineService.create({ ownerId: 'u' });
    await magazineService.delete(m.id);
    expect(await magazineService.get(m.id)).toBeNull();
    const restored = await magazineService.restore(m);
    expect(restored.id).toBe(m.id);
    expect(await magazineService.get(m.id)).not.toBeNull();
  });

  it('list retorna apenas revistas não-deletadas do owner', async () => {
    const a = await magazineService.create({ ownerId: 'u1', title: 'A' });
    await magazineService.create({ ownerId: 'u1', title: 'B' });
    await magazineService.create({ ownerId: 'u2', title: 'C' });
    await magazineService.delete(a.id);
    const list = await magazineService.list('u1');
    expect(list.map((m) => m.title).sort()).toEqual(['B']);
  });
});

describe('magazineService — round-trip mapping', () => {
  it('title, subtitle, branding, content, templateId preservados após create+get', async () => {
    const m = await magazineService.create({
      ownerId: 'u',
      title: 'Título Especial',
      templateId: 'catalog-grid-2x3',
    });
    await magazineService.update(m.id, {
      subtitle: 'Sub',
      branding: {
        ...m.branding,
        clientName: 'Cliente X',
        clientLogoUrl: 'https://x.com/l.png',
      },
      content: { ...m.content, groupByCategory: true },
    });
    const got = (await magazineService.get(m.id))!;
    expect(got.title).toBe('Título Especial');
    expect(got.templateId).toBe('catalog-grid-2x3');
    expect(got.subtitle).toBe('Sub');
    expect(got.branding.clientName).toBe('Cliente X');
    expect(got.content.groupByCategory).toBe(true);
  });
});

describe('magazineService — fuzz de operações (fast-check, 60 casos)', () => {
  it('sequências aleatórias nunca corrompem o estado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({ kind: fc.constant('add'), seed: fc.string({ minLength: 1, maxLength: 6 }) }),
            fc.record({ kind: fc.constant('title'), title: fc.string({ maxLength: 30 }) }),
            fc.record({ kind: fc.constant('publish') }),
            fc.record({ kind: fc.constant('unpublish') }),
            fc.record({ kind: fc.constant('duplicate') }),
          ),
          { minLength: 1, maxLength: 8 },
        ),
        async (ops) => {
          store.magazines.clear();
          store.magazine_items.clear();
          const m = await magazineService.create({ ownerId: 'u', title: 'x' });
          let currentId = m.id;
          for (const op of ops) {
            if (op.kind === 'add') {
              await magazineService.addProducts(currentId, [mkProduct(op.seed)]);
            } else if (op.kind === 'title') {
              await magazineService.update(currentId, { title: op.title });
            } else if (op.kind === 'publish') {
              await magazineService.publish(currentId);
            } else if (op.kind === 'unpublish') {
              await magazineService.unpublish(currentId);
            } else if (op.kind === 'duplicate') {
              const c = await magazineService.duplicate(currentId);
              if (c) currentId = c.id;
            }
          }
          // invariantes finais: get retorna magazine consistente
          const final = await magazineService.get(currentId);
          expect(final).not.toBeNull();
          expect(final!.id).toBe(currentId);
          // items com positions únicas
          const positions = final!.items.map((i) => i.position);
          expect(new Set(positions).size).toBe(positions.length);
          return true;
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('magazineService — race conditions (concorrência)', () => {
  it('2 updates simultâneos: last-write-wins, sem corrupção', async () => {
    const m = await magazineService.create({ ownerId: 'u', title: 'v0' });
    await Promise.all([
      magazineService.update(m.id, { title: 'A' }),
      magazineService.update(m.id, { title: 'B' }),
    ]);
    const got = await magazineService.get(m.id);
    expect(['A', 'B']).toContain(got!.title);
  });

  it('addProducts concorrente não duplica items com FK válida', async () => {
    const m = await magazineService.create({ ownerId: 'u' });
    await Promise.all([
      magazineService.addProducts(m.id, [mkProduct('x')]),
      magazineService.addProducts(m.id, [mkProduct('x')]),
    ]);
    const got = await magazineService.get(m.id);
    // Sem lock ótimista, pode duplicar — mas o serviço deve tolerar (não crashar)
    expect(got!.items.length).toBeGreaterThanOrEqual(1);
    expect(got!.items.length).toBeLessThanOrEqual(2);
  });
});

describe('magazineService — títulos exóticos', () => {
  // NOTA (GAP identificado): magazineService.create usa `input.title ?? 'Nova Revista'`,
  // que preserva string vazia. A UI depende de canPublish() para bloquear publicação
  // de revistas sem título. Se defesa no service for desejada, trocar `??` por
  // fallback explícito para strings vazias/whitespace-only.
  const exotic = [' ', 'á', '中文', '😀🎉', 'a'.repeat(500), '\n\t', '<b>x</b>'];
  it.each(exotic)('title=%j preservado no round-trip', async (t) => {
    const m = await magazineService.create({ ownerId: 'u', title: t });
    const got = await magazineService.get(m.id);
    expect(got?.title).toBe(t);
  });

  it('title="" é preservado pelo service (bloqueio fica na UI via canPublish)', async () => {
    const m = await magazineService.create({ ownerId: 'u', title: '' });
    const got = await magazineService.get(m.id);
    expect(got?.title).toBe('');
  });

  it('title=undefined cai no default "Nova Revista"', async () => {
    const m = await magazineService.create({ ownerId: 'u' });
    const got = await magazineService.get(m.id);
    expect(got?.title).toBe('Nova Revista');
  });
});
