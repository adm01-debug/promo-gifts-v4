import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db/bridge';

const NOVELTY_WINDOW_DAYS = 30;
const NOVELTY_SELECT =
  'id, name, sku, primary_image_url, sale_price, category_id, supplier_id, created_at, stock_quantity, min_quantity';

const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Eletr\u00f4nicos' },
  { id: 'cat-2', name: 'Escrit\u00f3rio' },
  { id: 'cat-3', name: 'Acess\u00f3rios' },
  { id: 'cat-4', name: 'Lifestyle' },
];

const MOCK_SUPPLIERS = [
  { id: 'sup-1', name: 'Tech Gifts S.A.', code: 'TGS' },
  { id: 'sup-2', name: 'Premium Office', code: 'POF' },
  { id: 'sup-3', name: 'Global Merch', code: 'GME' },
];

const getMockDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

type RawProduct = {
  id: string;
  name: string;
  sku: string;
  primary_image_url: string;
  sale_price: number;
  category_id: string;
  supplier_id: string;
  created_at: string;
  stock_quantity: number;
  min_quantity: number;
};

type CategoryRecord = { id: string; name: string };
type SupplierRecord = { id: string; name: string; code?: string };

const MOCK_PRODUCTS: RawProduct[] = [
  {
    id: 'mock-1',
    name: 'Smartwatch Ultra Pro X',
    sku: 'SW-001',
    primary_image_url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80',
    sale_price: 299.9,
    category_id: 'cat-1',
    supplier_id: 'sup-1',
    created_at: getMockDate(0),
    stock_quantity: 45,
    min_quantity: 10,
  },
  {
    id: 'mock-2',
    name: 'Caderno Moleskine Executive',
    sku: 'NB-202',
    primary_image_url: 'https://images.unsplash.com/photo-1544816153-0973059446d3?w=800&q=80',
    sale_price: 89.0,
    category_id: 'cat-2',
    supplier_id: 'sup-2',
    created_at: getMockDate(2),
    stock_quantity: 5,
    min_quantity: 15,
  },
  {
    id: 'mock-3',
    name: 'Garrafa T\u00e9rmica Titanium',
    sku: 'BT-500',
    primary_image_url: 'https://images.unsplash.com/photo-1602143394807-a2536fe0589a?w=800&q=80',
    sale_price: 124.5,
    category_id: 'cat-4',
    supplier_id: 'sup-3',
    created_at: getMockDate(5),
    stock_quantity: 120,
    min_quantity: 20,
  },
  {
    id: 'mock-4',
    name: 'Fone Bluetooth Noise Cancelling',
    sku: 'HP-99',
    primary_image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    sale_price: 450.0,
    category_id: 'cat-1',
    supplier_id: 'sup-1',
    created_at: getMockDate(12),
    stock_quantity: 0,
    min_quantity: 5,
  },
  {
    id: 'mock-5',
    name: 'Kit Canetas Premium Metal',
    sku: 'PN-05',
    primary_image_url: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=800&q=80',
    sale_price: 45.0,
    category_id: 'cat-2',
    supplier_id: 'sup-2',
    created_at: getMockDate(25),
    stock_quantity: 300,
    min_quantity: 50,
  },
];

export type NoveltyWithDetails = {
  id: string;
  product_id: string;
  supplier_id: string;
  novelty_start: string;
  novelty_end: string;
  days_remaining: number;
  product?: {
    id: string;
    name: string;
    sku: string;
    primary_image_url: string;
    sale_price: number;
    stock_quantity: number;
    min_quantity: number;
    category_name?: string;
    supplier_name?: string;
    days_remaining?: number;
  };
};

type NoveltyRecord = {
  id: string;
  product_id: string;
  supplier_id: string;
  novelty_start: string;
  novelty_end: string;
  days_remaining: number;
};

const NOVELTY_RECORD_SELECT = 'id, product_id, supplier_id, novelty_start, novelty_end, days_remaining';

async function fetchNovelties(): Promise<NoveltyWithDetails[]> {
  const now = new Date().toISOString();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NOVELTY_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString();

  try {
    const result = await invokeExternalDb<NoveltyRecord>({
      table: 'novelty_products',
      operation: 'select',
      select: NOVELTY_RECORD_SELECT,
      filters: {
        novelty_end: `gte.${now}`,
        novelty_start: `gte.${cutoffStr}`,
      },
      orderBy: 'days_remaining',
      orderDir: 'asc',
      limit: 200,
    });

    if (!result.records.length) {
      return buildMockNovelties();
    }

    return enrichNovelties(result.records);
  } catch {
    return buildMockNovelties();
  }
}

function buildMockNovelties(): NoveltyWithDetails[] {
  const now = new Date();
  return MOCK_PRODUCTS.map((product, index) => {
    const startDate = new Date(product.created_at);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + NOVELTY_WINDOW_DAYS);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      id: `mock-novelty-${index + 1}`,
      product_id: product.id,
      supplier_id: product.supplier_id,
      novelty_start: product.created_at,
      novelty_end: endDate.toISOString(),
      days_remaining: daysRemaining,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        primary_image_url: product.primary_image_url,
        sale_price: product.sale_price,
        stock_quantity: product.stock_quantity,
        min_quantity: product.min_quantity,
        category_name: MOCK_CATEGORIES.find((c) => c.id === product.category_id)?.name,
        supplier_name: MOCK_SUPPLIERS.find((s) => s.id === product.supplier_id)?.name,
        days_remaining: daysRemaining,
      },
    };
  });
}

async function enrichNovelties(novelties: NoveltyWithDetails[]): Promise<NoveltyWithDetails[]> {
  const categoryIds = [...new Set(novelties.map((n) => n.product?.category_id).filter(Boolean))] as string[];
  const supplierIds = [...new Set(novelties.map((n) => n.supplier_id).filter(Boolean))] as string[];

  const isMock = novelties.some((n) => n.product_id.startsWith('mock-'));

  const [catResult, supResult] = await Promise.all([
    !isMock && categoryIds.length > 0
      ? invokeExternalDb<CategoryRecord>({
          table: 'categories',
          operation: 'select',
          select: 'id, name',
          filters: { id: `in.(${categoryIds.join(',')})` },
          limit: 500,
        })
      : { records: isMock ? MOCK_CATEGORIES : ([] as CategoryRecord[]) },
    !isMock && supplierIds.length > 0
      ? invokeExternalDb<SupplierRecord>({
          table: 'suppliers',
          operation: 'select',
          select: 'id, name',
          filters: { id: `in.(${supplierIds.join(',')})` },
          limit: 200,
        })
      : { records: isMock ? MOCK_SUPPLIERS : ([] as SupplierRecord[]) },
  ]);

  const catMap = new Map(catResult.records.map((c) => [c.id, c.name]));
  const supMap = new Map(supResult.records.map((s) => [s.id, s.name]));

  return novelties.map((n) => ({
    ...n,
    product: n.product
      ? {
          ...n.product,
          category_name: catMap.get(n.product.category_id ?? '') || n.product.category_name,
          supplier_name: supMap.get(n.supplier_id) || n.product.supplier_name,
        }
      : undefined,
  }));
}

export function useNovelties() {
  return useQuery({
    queryKey: ['novelties'],
    queryFn: fetchNovelties,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNoveltyStats() {
  return useQuery({
    queryKey: ['novelty-stats'],
    queryFn: async () => {
      const novelties = await fetchNovelties();

      const total = novelties.length;
      const expiringSoon = novelties.filter((n) => n.days_remaining <= 7).length;
      const fresh = novelties.filter((n) => n.days_remaining >= NOVELTY_WINDOW_DAYS - 3).length;
      const outOfStock = novelties.filter((n) => (n.product?.stock_quantity ?? 1) === 0).length;

      const supplierCounts: Record<string, number> = {};
      for (const n of novelties) {
        if (n.supplier_id) {
          supplierCounts[n.supplier_id] = (supplierCounts[n.supplier_id] || 0) + 1;
        }
      }

      let topSupplierId: string | null = null;
      let topCount = 0;
      for (const [id, count] of Object.entries(supplierCounts)) {
        if (count > topCount) {
          topCount = count;
          topSupplierId = id;
        }
      }

      let topSupplierName: string | null = null;
      if (topSupplierId) {
        const sid = topSupplierId as string;
        if (sid.startsWith('sup-')) {
          topSupplierName = MOCK_SUPPLIERS.find((s) => s.id === sid)?.name || null;
        } else {
          try {
            const supResult = await invokeExternalDb<{ name: string }>({
              table: 'suppliers',
              operation: 'select',
              select: 'name',
              filters: { id: sid },
              limit: 1,
            });
            topSupplierName = supResult.records[0]?.name || null;
          } catch {
            /* fallback */
          }
        }
      }

      return {
        total,
        expiringSoon,
        fresh,
        outOfStock,
        topSupplier: topSupplierName,
        topSupplierId,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}
