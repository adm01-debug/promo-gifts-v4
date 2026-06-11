import { describe, it, expect } from 'vitest';
import {
  GOLD_READ_ALIASES,
  GOLD_RELATIONS,
} from '@/integrations/supabase/gold-relations';

/**
 * Contrato da camada OURO (Medallion) — invariantes verificados contra o SSOT
 * doufsxqlfjyuvxuezpln em 2026-06-11 (auditoria integração frontend↔medallion).
 */
describe('Gold relations (camada Ouro do Medallion)', () => {
  it('aliases de leitura apontam para views públicas conhecidas', () => {
    expect(GOLD_READ_ALIASES.products).toBe('v_products_public');
    expect(GOLD_READ_ALIASES.suppliers).toBe('v_suppliers_public');
  });

  it('todo alvo de alias está na lista de relações Ouro', () => {
    for (const target of Object.values(GOLD_READ_ALIASES)) {
      expect(GOLD_RELATIONS).toContain(target);
    }
  });

  it('NÃO aliasa print_area_techniques (wizard admin lê/edita unit_cost na base)', () => {
    // Decisão documentada em gold-relations.ts: a view pública oculta unit_cost,
    // mas o caminho dbInvoke é usado pelo wizard de gravação, que precisa da base.
    expect(Object.keys(GOLD_READ_ALIASES)).not.toContain('print_area_techniques');
  });

  it('não contém relações Bronze/Prata (frontend nunca lê camadas inferiores)', () => {
    const forbidden = [
      'supplier_products_raw',
      'supplier_products_raw_history',
      'produtos_padronizacao',
      'produtos_padronizacao_variantes',
    ];
    for (const rel of forbidden) {
      expect(GOLD_RELATIONS as readonly string[]).not.toContain(rel);
      expect(Object.values(GOLD_READ_ALIASES) as string[]).not.toContain(rel);
    }
  });

  it('lista de relações Ouro não tem duplicatas', () => {
    expect(new Set(GOLD_RELATIONS).size).toBe(GOLD_RELATIONS.length);
  });

  it('inclui as views de observabilidade do pipeline', () => {
    expect(GOLD_RELATIONS).toContain('vw_medallion_coverage');
    expect(GOLD_RELATIONS).toContain('v_pipeline_progress');
  });
});
