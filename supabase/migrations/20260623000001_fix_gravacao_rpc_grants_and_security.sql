-- ============================================================================
-- MIGRATION: fix_gravacao_rpc_grants_and_security
-- DATA: 2026-06-23
-- DIAGNÓSTICO: investigação exaustiva Claude (análise de 70+ arquivos + REST API)
--
-- CAUSA RAIZ CONFIRMADA:
--   migration 20260513000003_t37b1_security_invoker_candidate_batch1.sql
--   converteu AMBAS as funções críticas de personalização para SECURITY INVOKER
--   SEM adicionar GRANT EXECUTE para authenticated.
--
-- SINTOMA:
--   Painel de Personalização (orçamento/produto) completamente vazio.
--   ConfigurationPanelV6 não exibe locais nem técnicas.
--   QuoteProductCustomization não mostra opções de gravação.
--
-- ERRO NO SUPABASE LOG:
--   42501: permission denied for function fn_get_product_customization_options
--   42501: permission denied for function fn_get_customization_price
--
-- DADOS CONFIRMADOS (não havia problema de dados):
--   print_area_techniques: 21.667 rows is_active=true
--   Produto 94297 (garrafa esportiva): 12 técnicas (CIRCULAR×4, LADO-A×4, LADO-B×4)
--   tabela_preco_gravacao_oficial: 56 registros ativos
--   tabela_preco_gravacao_oficial_faixa: 916 registros
--
-- POR QUE SECURITY DEFINER (não apenas GRANT + INVOKER):
--   print_area_techniques tem RLS ativada.
--   authenticated não tem policy SELECT direta na tabela base.
--   Só a view v_print_area_techniques_public é SECURITY DEFINER e tem GRANT.
--   Com INVOKER, mesmo com GRANT EXECUTE, a função retornaria 0 rows (RLS bloqueia).
--   DEFINER é o padrão correto: função roda como owner (postgres), acessa tudo.
--   search_path fixo previne privilege escalation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- FIX-01 (CRÍTICO): fn_get_product_customization_options
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.fn_get_product_customization_options(uuid)
  SECURITY DEFINER;

ALTER FUNCTION public.fn_get_product_customization_options(uuid)
  SET search_path = public;

GRANT EXECUTE ON FUNCTION public.fn_get_product_customization_options(uuid)
  TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- FIX-02 (CRÍTICO): fn_get_customization_price
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.fn_get_customization_price(
  uuid,      -- p_area_id
  integer,   -- p_quantidade
  integer,   -- p_num_cores DEFAULT 1
  numeric,   -- p_largura_cm DEFAULT NULL
  numeric,   -- p_altura_cm DEFAULT NULL
  integer    -- p_num_pontos DEFAULT 0
)
  SECURITY DEFINER;

ALTER FUNCTION public.fn_get_customization_price(
  uuid, integer, integer, numeric, numeric, integer
)
  SET search_path = public;

GRANT EXECUTE ON FUNCTION public.fn_get_customization_price(
  uuid, integer, integer, numeric, numeric, integer
)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- FIX-03 (Profilaxia): RLS policies de leitura
-- Garante que as funções DEFINER não dependam de acesso implícito
-- e que o wizard admin (PostgREST direto) leia as tabelas
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- tabela_preco_gravacao_oficial
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'tabela_preco_gravacao_oficial'
      AND policyname  = 'tpgo_authenticated_read'
  ) THEN
    EXECUTE '
      CREATE POLICY tpgo_authenticated_read
        ON public.tabela_preco_gravacao_oficial
        FOR SELECT
        TO authenticated, anon
        USING (ativo = true)
    ';
    RAISE NOTICE 'FIX-03a: policy tpgo_authenticated_read criada';
  ELSE
    RAISE NOTICE 'FIX-03a: policy tpgo_authenticated_read já existe — skip';
  END IF;

  -- tabela_preco_gravacao_oficial_faixa
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'tabela_preco_gravacao_oficial_faixa'
      AND policyname  = 'tpgof_authenticated_read'
  ) THEN
    EXECUTE '
      CREATE POLICY tpgof_authenticated_read
        ON public.tabela_preco_gravacao_oficial_faixa
        FOR SELECT
        TO authenticated, anon
        USING (true)
    ';
    RAISE NOTICE 'FIX-03b: policy tpgof_authenticated_read criada';
  ELSE
    RAISE NOTICE 'FIX-03b: policy tpgof_authenticated_read já existe — skip';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- VALIDAÇÃO — deve retornar 2 linhas com security_type = 'DEFINER'
-- ---------------------------------------------------------------------------
SELECT
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'fn_get_product_customization_options',
    'fn_get_customization_price'
  )
ORDER BY routine_name;
