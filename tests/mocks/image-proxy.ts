/**
 * SSOT de URLs mockadas para testes de imagens.
 *
 * Reutilizar em qualquer teste que exercite `OptimizedImage` ou lógica de
 * detecção/proxy de URLs externas. Garante query strings determinísticas
 * e evita duplicação de literais em vários specs.
 */
import { vi } from 'vitest';

export const MOCK_UNSPLASH_ID = 'photo-123456';
export const MOCK_SUPABASE_HOST = 'abc.supabase.co';
export const MOCK_CLOUDFLARE_ACCOUNT = 'abc123';

export function mockUnsplashSrc(id: string = MOCK_UNSPLASH_ID): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80`;
}

export function mockSupabaseSrc(path = 'products/image.jpg'): string {
  return `https://${MOCK_SUPABASE_HOST}/storage/v1/object/public/${path}`;
}

export function mockCloudflareSrc(
  productId = 'product-id',
  variant = 'public',
): string {
  return `https://imagedelivery.net/${MOCK_CLOUDFLARE_ACCOUNT}/${productId}/${variant}`;
}

/**
 * Neutraliza `src/utils/imageProxy` em ambiente de teste — retorna a URL
 * como identidade para que asserções sobre query strings sejam previsíveis.
 * Chamar no topo do spec, antes dos `import`s de componentes.
 */
export function mockImageProxyIdentity(): void {
  vi.mock('@/utils/imageProxy', () => ({
    proxyImage: (src: string) => src,
    default: (src: string) => src,
  }));
}
