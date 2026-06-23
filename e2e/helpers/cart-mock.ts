/**
 * cart-mock.ts — Helper para mockar respostas da API seller_carts em testes E2E.
 *
 * PROBLEMA ORIGINAL: 6 specs usavam localStorage 'cart-store-v1' para semear dados.
 * A app nunca lê essa chave — os dados eram silenciosamente ignorados e os testes
 * procuravam testIds como "cart-toggle-seed-cart-0" que jamais existiam no DOM real.
 *
 * SOLUÇÃO: interceptar a requisição PostgREST de seller_carts com page.route() e
 * retornar dados controlados. A app consome a resposta normalmente via React Query.
 */
import type { Page } from '@playwright/test';

export interface MockCartItem {
  id: string;
  cart_id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  product_price: number;
  quantity: number;
  color_name: string | null;
  color_hex: string | null;
  notes: string | null;
  sort_order: number | null;
  product_sku: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockCart {
  id: string;
  seller_id: string;
  company_id: string;
  company_name: string;
  company_location: string | null;
  company_logo_url: string | null;
  notes: string | null;
  status: 'novo' | 'em_negociacao' | 'pronto_orcamento';
  created_at: string;
  updated_at: string;
  seller_cart_items: MockCartItem[];
}

function ts(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

export function makeMockItem(cartId: string, idx: number, itemIdx: number): MockCartItem {
  const id = `mock-item-${cartId}-${itemIdx}`;
  return {
    id,
    cart_id: cartId,
    product_id: `mock-prod-${idx}-${itemIdx}`,
    product_name: `Produto mock ${idx}-${itemIdx}`,
    product_image_url: null,
    product_price: 19.9 + itemIdx,
    quantity: 10 + itemIdx,
    color_name: 'Preto',
    color_hex: '#000000',
    notes: null,
    sort_order: itemIdx,
    product_sku: `SKU-${idx}-${itemIdx}`,
    created_at: ts(3600000),
    updated_at: ts(),
  };
}

export function makeMockCart(idx: number, itemCount = 3): MockCart {
  const id = `mock-cart-${idx}`;
  return {
    id,
    seller_id: 'mock-seller-id',
    company_id: `mock-co-${idx}`,
    company_name: `Empresa mock ${idx.toString().padStart(2, '0')}`,
    company_location: 'Varejo | Revenda',
    company_logo_url: null,
    notes: null,
    status: 'novo',
    created_at: ts(86400000 * (idx + 1)),
    updated_at: ts(3600000 * idx),
    seller_cart_items: Array.from({ length: itemCount }, (_, j) => makeMockItem(id, idx, j)),
  };
}

/**
 * Intercepta GET /rest/v1/seller_carts* e retorna carrinhos mockados.
 * Deve ser chamado ANTES de qualquer navegação ou reload que acione a query.
 *
 * @param page - página Playwright
 * @param carts - array de carrinhos (use makeMockCart() para gerar)
 */
export async function mockSellerCartsAPI(page: Page, carts: MockCart[]): Promise<void> {
  await page.route('**/rest/v1/seller_carts**', (route) => {
    const url = route.request().url();
    // Só intercepta GET — deixa mutações (POST/PATCH/DELETE) passar
    if (route.request().method() !== 'GET') {
      route.continue();
      return;
    }
    // Ignora requests de other tables que contenham "seller_carts" na URL
    if (!url.includes('/seller_carts')) {
      route.continue();
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Content-Range': `0-${Math.max(0, carts.length - 1)}/${carts.length}`,
        'X-Mock-Source': 'cart-mock-helper',
      },
      body: JSON.stringify(carts),
    });
  });
}

/**
 * Conveniência: gera N carrinhos com itemCount itens cada e mocka a API.
 */
export async function seedAndMock(
  page: Page,
  opts: { count?: number; itemsPerCart?: number } = {},
): Promise<MockCart[]> {
  const { count = 3, itemsPerCart = 3 } = opts;
  const carts = Array.from({ length: count }, (_, i) => makeMockCart(i, itemsPerCart));
  await mockSellerCartsAPI(page, carts);
  return carts;
}
