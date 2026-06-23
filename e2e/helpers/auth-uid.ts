/**
 * auth-uid.ts — Extrai o UID do usuário logado da sessão Supabase no localStorage.
 *
 * CONTEXTO: O app usa localStorage com chaves namespacadas por UID:
 *   cart-view-mode:${uid}, cart-table-sort-key:${uid}, etc.
 *
 * Para os testes E2E lerem/escreverem as chaves corretas, precisam do UID
 * do usuário autenticado. A sessão Supabase é armazenada em localStorage com
 * a chave 'sb-${SUPABASE_PROJECT_REF}-auth-token'.
 *
 * Projeto: doufsxqlfjyuvxuezpln (canônico, veja supabase/client.ts)
 */
import type { Page } from '@playwright/test';

const SUPABASE_AUTH_KEY = 'sb-doufsxqlfjyuvxuezpln-auth-token';

/**
 * Retorna o UID do usuário autenticado lendo a sessão Supabase do localStorage.
 * Retorna null se não houver sessão ou se o JSON estiver malformado.
 *
 * Deve ser chamado APÓS loginAs() e APÓS a navegação para a página desejada.
 */
export async function getAuthUserId(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { user?: { id?: string } };
      return parsed?.user?.id ?? null;
    } catch {
      return null;
    }
  }, SUPABASE_AUTH_KEY);
}

/**
 * Constrói as chaves namespacadas do carrinho para um dado UID.
 * Espelha o padrão `const ns = (key: string) => \`\${key}:\${uid}\`` de SellerCartsPage.
 */
export function cartNs(uid: string) {
  return {
    viewMode:  `cart-view-mode:${uid}`,
    sortKey:   `cart-table-sort-key:${uid}`,
    sortDir:   `cart-table-sort-dir:${uid}`,
    pageSize:  `cart-table-page-size:${uid}`,
    columns:   `cart-table-columns:${uid}`,
    density:   `cart-table-density:${uid}`,
    gridCols:  `cart-grid-columns:${uid}`,
  } as const;
}
