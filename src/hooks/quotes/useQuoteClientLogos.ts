/**
 * useQuoteClientLogos — hidrata logomarcas de clientes (por CNPJ) via CRM externo
 * sem persistir nada no banco. Espelha o comportamento de Carrinhos
 * (que armazena `company_logo_url` nativamente).
 */
import { useQuery } from '@tanstack/react-query';
import { selectCrm } from '@/lib/crm-db';

interface CrmCompanyLogoRow {
  cnpj: string | null;
  logo_url: string | null;
}

export type LogoByCnpj = Record<string, string | null>;

const normalizeCnpj = (v?: string | null): string => (v ?? '').replace(/\D/g, '');

export function useQuoteClientLogos(cnpjs: Array<string | null | undefined>) {
  const normalized = Array.from(
    new Set(cnpjs.map(normalizeCnpj).filter((c) => c.length > 0)),
  ).sort();

  return useQuery<LogoByCnpj>({
    queryKey: ['quote-client-logos', normalized],
    enabled: normalized.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Chunk em blocos de 50 CNPJs para evitar statement_timeout no CRM
      // quando o orçamento referencia dezenas de clientes.
      const CHUNK = 50;
      const map: LogoByCnpj = {};
      for (let i = 0; i < normalized.length; i += CHUNK) {
        const slice = normalized.slice(i, i + CHUNK);
        const rows = await selectCrm<CrmCompanyLogoRow>('companies', {
          select: 'cnpj, logo_url',
          filters: { cnpj: { in: slice } },
          limit: slice.length,
        });
        for (const row of rows) {
          const key = normalizeCnpj(row.cnpj);
          if (key) map[key] = row.logo_url || null;
        }
      }
      return map;
    },

  });
}

export { normalizeCnpj };
