/**
 * usePublicoAlvoOptions - opcoes de Publico-Alvo (Super Filtro)
 *
 * Le os valores de publico-alvo do SSOT `v_super_filtro_options`
 * (filtro_tipo = 'target_audience'), retornando os slugs canonicos
 * (corporativo, feminino, esportivo, infantil, unissex, masculino) na
 * ordem de exibicao. Esses slugs sao exatamente os valores armazenados em
 * products.target_audience e casados pela RPC fn_super_filtro_product_ids (_publico).
 *
 * Antes, as opcoes vinham de products.tags.publicoAlvo, que o catalogo
 * lightweight nunca hidrata -> a secao ficava eternamente vazia.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface SuperFiltroOptionRow {
  slug_ou_codigo: string | null;
  ordem: number | null;
}

export function usePublicoAlvoOptions(): string[] {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dbInvoke<SuperFiltroOptionRow>({
          table: 'v_super_filtro_options',
          operation: 'select',
          select: 'slug_ou_codigo, ordem',
          filters: { filtro_tipo: 'target_audience' },
          orderBy: { column: 'ordem', ascending: true },
          limit: 100,
          offset: 0,
        });
        if (cancelled) return;
        const vals = (res.records || [])
          .map((r) => r.slug_ou_codigo)
          .filter((v): v is string => typeof v === 'string' && v.length > 0);
        setOptions(vals);
      } catch (err) {
        logger.error('[usePublicoAlvoOptions] erro ao carregar opcoes:', err);
        if (!cancelled) setOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}
