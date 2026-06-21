import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Row = {
  product_id: string;
  color_name: string | null;
  color_hex: string | null;
  selected_thumbnail: string | null;
  images: string[] | null;
  stock_quantity: number | null;
};
interface MockBuilder {
  select: () => MockBuilder;
  in: () => MockBuilder;
  eq: () => MockBuilder;
  not: () => MockBuilder;
  order: () => MockBuilder;
  range: () => Promise<{ data: Row[]; error: null }>;
}

let __rows: Row[] = [];
let __rangeCalls = 0;

vi.mock('@/lib/supabase-direct', () => ({
  resolveTable: (t: string) => t,
  handleQueryError: () => undefined,
}));
vi.mock('@/lib/supabase-untyped', () => ({
  untypedFrom: (): MockBuilder => {
    const b: MockBuilder = {
      select: () => b,
      in: () => b,
      eq: () => b,
      not: () => b,
      order: () => b,
      range: () => {
        const data = __rangeCalls === 0 ? __rows : [];
        __rangeCalls += 1;
        return Promise.resolve({ data, error: null });
      },
    };
    return b;
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: () => undefined, warn: () => undefined, info: () => undefined, debug: () => undefined },
}));

import {
  useProductsColorsBatch,
  clearColorsCache,
  type ProductColorDot,
} from '@/hooks/products/useProductsColorsBatch';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
function uuid(): string {
  const h = () => Math.floor(Math.random() * 16).toString(16);
  const s = (n: number) => Array.from({ length: n }, h).join('');
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${s(8)}-${s(4)}-4${s(3)}-${variant}${s(3)}-${s(12)}`;
}
function find(arr: ProductColorDot[], n: string): ProductColorDot {
  const c = arr.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!c) throw new Error(`cor não encontrada: ${n}`);
  return c;
}

async function runFor(rows: Array<Partial<Row>>): Promise<ProductColorDot[]> {
  const pid = uuid();
  __rows = rows.map((r) => ({
    product_id: pid,
    color_name: null,
    color_hex: null,
    selected_thumbnail: null,
    images: null,
    stock_quantity: null,
    ...r,
  }));
  __rangeCalls = 0;
  const { result } = renderHook(() => useProductsColorsBatch([pid]), { wrapper });
  await waitFor(() => expect(result.current.data.get(pid)).toBeDefined());
  return result.current.data.get(pid) ?? [];
}

beforeEach(() => {
  clearColorsCache();
  __rangeCalls = 0;
  __rows = [];
});

describe('useProductsColorsBatch — agregação (SSOT de cor/estoque)', () => {
  it('SOMA stockQty por (nome|hex)', async () => {
    const colors = await runFor([
      { color_name: 'Azul', color_hex: '#00f', selected_thumbnail: 'a.png', stock_quantity: 5 },
      { color_name: 'Azul', color_hex: '#00f', selected_thumbnail: 'a.png', stock_quantity: 7 },
      { color_name: 'Verde', color_hex: '#0f0', selected_thumbnail: 'v.png', stock_quantity: 2 },
    ]);
    expect(colors).toHaveLength(2);
    expect(find(colors, 'Azul').stockQty).toBe(12);
    expect(find(colors, 'Verde').stockQty).toBe(2);
  });

  it('clamp >=0: negativos contam como 0 na soma', async () => {
    const colors = await runFor([
      { color_name: 'Azul', color_hex: '#00f', stock_quantity: -10 },
      { color_name: 'Azul', color_hex: '#00f', stock_quantity: 3 },
      { color_name: 'Roxo', color_hex: '#808', stock_quantity: -5 },
    ]);
    expect(find(colors, 'Azul').stockQty).toBe(3);
    expect(find(colors, 'Roxo').stockQty).toBe(0);
  });

  it('null/NaN em stock_quantity => 0', async () => {
    const colors = await runFor([
      { color_name: 'Preto', color_hex: '#000', stock_quantity: null },
      { color_name: 'Cinza', color_hex: '#888', stock_quantity: Number.NaN },
    ]);
    expect(find(colors, 'Preto').stockQty).toBe(0);
    expect(find(colors, 'Cinza').stockQty).toBe(0);
  });

  it('mesmo nome + hex DIFERENTE => cores separadas', async () => {
    const colors = await runFor([
      { color_name: 'Azul', color_hex: '#00f', stock_quantity: 5 },
      { color_name: 'Azul', color_hex: '#000', stock_quantity: 3 },
    ]);
    expect(colors).toHaveLength(2);
    expect(colors.filter((c) => c.name === 'Azul')).toHaveLength(2);
    expect(colors.map((c) => c.stockQty).sort((a, b) => a - b)).toEqual([3, 5]);
  });

  it('chave case-insensitive (nome+hex) => soma numa única cor', async () => {
    const colors = await runFor([
      { color_name: 'Azul', color_hex: '#00F', stock_quantity: 5 },
      { color_name: 'azul', color_hex: '#00f', stock_quantity: 7 },
    ]);
    expect(colors).toHaveLength(1);
    expect(colors[0].stockQty).toBe(12);
  });

  it('preenche imagem faltante a partir de ocorrência posterior', async () => {
    const colors = await runFor([
      { color_name: 'Azul', color_hex: '#00f', selected_thumbnail: null, images: null, stock_quantity: 5 },
      { color_name: 'Azul', color_hex: '#00f', selected_thumbnail: 'x.png', stock_quantity: 7 },
    ]);
    expect(colors).toHaveLength(1);
    expect(colors[0].image).toBe('x.png');
    expect(colors[0].stockQty).toBe(12);
  });

  it('nome vazio/whitespace é ignorado', async () => {
    const colors = await runFor([
      { color_name: '', color_hex: '#00f', stock_quantity: 5 },
      { color_name: '   ', color_hex: '#000', stock_quantity: 3 },
      { color_name: 'Azul', color_hex: '#0f0', stock_quantity: 9 },
    ]);
    expect(colors).toHaveLength(1);
    expect(colors[0].name).toBe('Azul');
    expect(colors[0].stockQty).toBe(9);
  });

  it('imagem vem de images[0] quando selected_thumbnail é null', async () => {
    const colors = await runFor([
      { color_name: 'Azul', color_hex: '#00f', selected_thumbnail: null, images: ['i0.png', 'i1.png'], stock_quantity: 1 },
    ]);
    expect(colors[0].image).toBe('i0.png');
  });

  it('ordena cores por nome (pt-BR)', async () => {
    const colors = await runFor([
      { color_name: 'Verde', color_hex: '#0f0', stock_quantity: 1 },
      { color_name: 'Azul', color_hex: '#00f', stock_quantity: 1 },
      { color_name: 'Branco', color_hex: '#fff', stock_quantity: 1 },
    ]);
    expect(colors.map((c) => c.name)).toEqual(['Azul', 'Branco', 'Verde']);
  });
});
