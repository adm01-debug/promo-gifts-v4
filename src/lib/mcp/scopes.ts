/**
 * Catálogo canônico de escopos de chaves MCP (espelho client-side).
 *
 * Mantenha sincronizado com `supabase/functions/_shared/mcp-scopes.ts` —
 * a edge function `mcp-keys-issue` valida o payload contra a versão dela,
 * então qualquer escopo novo precisa ser adicionado nos dois lugares.
 */

export const KNOWN_SCOPES = [
  'quotes:read',
  'orders:read',
  'crm:read',
  'products:read',
  'code:read',
  'code:write',
  '*',
] as const;

export type McpScope = (typeof KNOWN_SCOPES)[number];

export const FULL_SCOPE: McpScope = '*';

export const FULL_SCOPE_CONFIRMATION = 'CONCEDER FULL';

export const FULL_SCOPE_MIN_JUSTIFICATION = 20;

export const FULL_SCOPE_MAX_TTL_DAYS = 180;

export const FULL_SCOPE_DEFAULT_TTL_DAYS = 90;

/** Descrição amigável de cada escopo para tooltips e UI. */
export const SCOPE_DESCRIPTIONS: Record<
  McpScope,
  { label: string; tools: string[]; severity: 'low' | 'medium' | 'high' | 'critical' }
> = {
  'quotes:read': {
    label: 'Leitura de orçamentos',
    tools: ['list_quotes', 'get_quote', 'get_quote_items'],
    severity: 'low',
  },
  'orders:read': {
    label: 'Leitura de pedidos',
    tools: ['list_orders', 'get_order'],
    severity: 'low',
  },
  'crm:read': {
    label: 'Leitura de CRM',
    tools: ['search_companies', 'get_company', 'get_contacts'],
    severity: 'medium',
  },
  'products:read': {
    label: 'Leitura de catálogo',
    tools: ['search_products', 'get_product', 'get_variants'],
    severity: 'low',
  },
  'code:read': {
    label: 'Leitura de código-fonte (GitHub)',
    tools: ['list_repo_files', 'read_repo_file'],
    severity: 'medium',
  },
  'code:write': {
    label: 'Escrita de código-fonte (GitHub)',
    tools: ['write_repo_file'],
    severity: 'high',
  },
  '*': {
    label: 'Acesso total (FULL)',
    tools: ['TODAS as tools — leitura e escrita em código, CRM, orçamentos e catálogo'],
    severity: 'critical',
  },
};

export function isFullAccess(scopes: readonly string[]): boolean {
  return scopes.includes(FULL_SCOPE);
}
