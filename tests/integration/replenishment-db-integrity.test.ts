import { describe, it, expect, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// GAP (auditoria 200-commits): este é um teste de INTEGRAÇÃO que faz fetch real
// contra o banco vivo (sem mock). No gate unitário (quality-gate) ele estoura o
// timeout / dá ECONNREFUSED porque não há Supabase local. Alinhado à convenção
// do repo (RUN_INTEGRATION_TESTS, ver package.json), roda só sob demanda.
const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1';

describe.skipIf(!runIntegration)('Edge Function Simulation: Replenishment Triggers', () => {
  it('Deve validar integridade dos dados de reposição via RPC/View', async () => {
    // Simula chamada que o hook faz
    const { data, error } = await supabase
      .from('v_products_public')
      .select('id, name, updated_at, created_at, stock_quantity, min_quantity')
      .eq('is_active', true)
      .limit(10);

    if (error) throw error;

    data.forEach(p => {
      if (p.updated_at && p.created_at) {
        const delta = new Date(p.updated_at).getTime() - new Date(p.created_at).getTime();
        // A lógica de reposição exige delta > 24h
        // Aqui apenas validamos que os dados existem e são datas válidas
        expect(isNaN(new Date(p.updated_at).getTime())).toBe(false);
      }
    });
  });
});
