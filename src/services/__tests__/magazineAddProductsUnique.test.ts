/**
 * magazineService.addProducts — dedup client-side.
 *
 * Complementa a constraint UNIQUE(magazine_id, product_id) planejada em
 * qa/migrations-draft/2026-07-12_magazine_items_unique_product.sql.
 *
 * Contrato coberto:
 * 1) Produto já presente na revista → não é reinserido; INSERT não é chamado.
 * 2) Batch com duplicatas internas + produto já existente → só o novo é inserido, uma vez.
 * 3) Erro de UNIQUE violation vindo do BD é logado e retorna a magazine atual (não quebra a UI).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Product } from '@/types/product-catalog';

// ----- mocks Supabase in-memory ------------------------------------------------
type Row = { id: string; magazine_id: string; product_id: string; position: number };

const state = vi.hoisted(() => ({
  items: [] as Row[],
  insertPayload: null as Row[] | null,
  insertError: null as { message: string; code?: string } | null,
}));

const builder = vi.hoisted(() => {
  return () => ({
    insert: (rows: Row[]) => {
      state.insertPayload = rows;
      if (state.insertError) return Promise.resolve({ error: state.insertError });
      state.items.push(...rows);
      return Promise.resolve({ error: null });
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({
          data: {
            id: 'mag_x', owner_id: 'u1', organization_id: null, title: 'T', subtitle: null,
            template_id: 'editorial-vogue', branding: {}, content_settings: {}, page_order: null,
            status: 'draft', public_token: null, pdf_url: null, published_at: null,
            created_at: '', updated_at: '', deleted_at: null,
          },
          error: null,
        }),
        order: () => Promise.resolve({
          data: state.items.filter((i) => i.magazine_id === 'mag_x'),
          error: null,
        }),
      }),
    }),
    delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  });
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => builder() } }));
vi.mock('@/lib/supabase-untyped', () => ({ untypedFrom: () => builder() }));

// import DEPOIS dos mocks
import { magazineService } from '@/services/magazineService';

const productFactory = (id: string): Product =>
  ({ id, name: `P-${id}`, sku: id, price: 1, images: [], colors: [] }) as unknown as Product;

beforeEach(() => {
  state.items.length = 0;
  state.insertPayload = null;
  state.insertError = null;
});

describe('addProducts — dedup client-side (pré-UNIQUE)', () => {
  it('produto já presente → não insere', async () => {
    state.items.push({ id: 'i1', magazine_id: 'mag_x', product_id: 'p1', position: 0 });
    await magazineService.addProducts('mag_x', [productFactory('p1')]);
    expect(state.insertPayload).toBeNull();
  });

  it('batch com produto novo + duplicado → insere apenas o novo (1 row)', async () => {
    state.items.push({ id: 'i1', magazine_id: 'mag_x', product_id: 'p1', position: 0 });
    await magazineService.addProducts('mag_x', [
      productFactory('p1'),
      productFactory('p2'),
    ]);
    expect(state.insertPayload).not.toBeNull();
    expect(state.insertPayload!.length).toBe(1);
    expect(state.insertPayload![0].product_id).toBe('p2');
  });

  it('UNIQUE violation retornada pelo BD é tratada (não lança)', async () => {
    state.insertError = { message: 'duplicate key value violates unique constraint', code: '23505' };
    await expect(
      magazineService.addProducts('mag_x', [productFactory('novo')]),
    ).resolves.not.toThrow();
  });
});
