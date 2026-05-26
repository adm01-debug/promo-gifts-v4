-- ============================================================
-- BUGFIX: Auditoria Exaustiva do Banco de Dados — 26/05/2026
-- Autor: TIPROMO (Claude Sonnet 4.6)
-- PR: fix/db-audit-20260526
-- ============================================================

-- -------------------------------------------------------
-- CONTEXT: B01 - quote_items subtotal
-- Verificacao revelou que o registro aparentemente "errado"
-- ed95740c esta CORRETO:
--   unit_price=21.50, qty=200, personalization_cost=1087.90
--   subtotal = 21.50*200 + 1087.90 = 5387.90 ✅
-- Adicionamos apenas um CHECK de segurança para o futuro.
-- -------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_quote_items_subtotal_positive'
    AND conrelid = 'public.quote_items'::regclass
  ) THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT chk_quote_items_subtotal_positive
      CHECK (subtotal >= 0);
  END IF;
END$$;

-- -------------------------------------------------------
-- FIX B02: negotiation_markup_percent não persistido
-- 3 cotações ORC-2026-001/002/003 têm total 5% > subtotal
-- mas o campo estava zerado — backfill do valor real.
-- -------------------------------------------------------
UPDATE public.quotes
SET negotiation_markup_percent = ROUND((total / NULLIF(subtotal, 0) - 1) * 100, 4)
WHERE 
  negotiation_markup_percent = 0
  AND total IS NOT NULL 
  AND subtotal IS NOT NULL 
  AND subtotal > 0
  AND total > subtotal
  AND ABS(shipping_cost) < 0.01
  AND ABS(tax_amount) < 0.01
  AND ABS(COALESCE(discount_amount,0)) < 0.01;

-- Registro de auditoria
INSERT INTO public.admin_audit_log (
  action, entity_type, entity_id, new_values, user_id, created_at
)
SELECT 
  'BUGFIX_MARKUP_PERCENT_BACKFILL',
  'quotes',
  id::text,
  jsonb_build_object(
    'quote_number', quote_number,
    'subtotal', subtotal,
    'total', total,
    'negotiation_markup_percent_set', ROUND((total / NULLIF(subtotal, 0) - 1) * 100, 4),
    'fixed_at', now(),
    'fix_pr', 'fix/db-audit-20260526'
  ),
  NULL,
  now()
FROM public.quotes
WHERE 
  quote_number IN ('ORC-2026-001', 'ORC-2026-002', 'ORC-2026-003')
  AND total > subtotal
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- FIX B04: Desativar 4 produtos ativos sem preço
-- Fornecedor: Asia Import (d2734e23-d633-4819-bb15-e51aa44e2118)
-- -------------------------------------------------------
UPDATE public.products
SET 
  is_active = false,
  active = false,
  updated_at = now()
WHERE 
  cost_price IS NULL 
  AND sale_price IS NULL 
  AND is_active = true 
  AND (is_deleted IS NULL OR is_deleted = false)
  AND id IN (
    'c31e3eae-b923-4f4e-9815-88c043454fc0',  -- Mochila Compartimento Vacuo
    'aa01c9c1-7b60-449a-a9a5-36aa57561031',  -- Mochila para notebook
    '6dce7b4f-c536-4d7b-9d09-43b8c700e223',  -- Caneta Metalica #1
    'e36c0717-4c69-4bcc-9c6e-f1af3cb9f77d'   -- Caneta Metalica #2
  );

-- Registro de auditoria
INSERT INTO public.admin_audit_log (
  action, entity_type, entity_id, new_values, user_id, created_at
)
SELECT 
  'BUGFIX_DEACTIVATE_PRODUCT_NO_PRICE',
  'products',
  id::text,
  jsonb_build_object(
    'name', name,
    'supplier_id', supplier_id,
    'reason', 'Produto ativo sem cost_price nem sale_price - desativado por auditoria 26/05/2026',
    'fix_pr', 'fix/db-audit-20260526',
    'fixed_at', now()
  ),
  NULL,
  now()
FROM public.products
WHERE id IN (
  'c31e3eae-b923-4f4e-9815-88c043454fc0',
  'aa01c9c1-7b60-449a-a9a5-36aa57561031',
  '6dce7b4f-c536-4d7b-9d09-43b8c700e223',
  'e36c0717-4c69-4bcc-9c6e-f1af3cb9f77d'
)
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- DOCUMENTACAO B03: Tabelas duplicadas — comentários COMMENTS
-- -------------------------------------------------------
COMMENT ON TABLE public.smoke_test_runs IS 
  'DEPRECADA: use smoke_tests_runs. Esta tabela esta vazia (0 registros). ' ||
  'smoke_tests_runs tem 28 registros. Ver PR fix/db-audit-20260526.';

COMMENT ON TABLE public.smoke_tests_runs IS 
  'Tabela ATIVA de smoke tests. smoke_test_runs esta deprecada e vazia. ' ||
  'Ver PR fix/db-audit-20260526.';

COMMENT ON TABLE public.login_attempts IS 
  'Tabela legada com 203 registros. auth_login_attempts e a versao mais nova ' ||
  '(campo metadata adicional) mas esta vazia. Consolidacao pendente.';

COMMENT ON TABLE public.auth_login_attempts IS 
  'Versao mais recente de login_attempts (com metadata). Atualmente vazia. ' ||
  'login_attempts e a tabela populada (203 registros). Consolidacao pendente.';

COMMENT ON TABLE public.audit_log IS 
  'Tabela de auditoria legada (3 registros). admin_audit_log e a principal (18k+). ' ||
  'audit_logs (estrutura diferente, vazia) pode ser descontinuada.';

COMMENT ON COLUMN public.products.category_id IS 
  'Subcategoria especifica do produto (folha da arvore de categorias). ' ||
  'Ex: "Canetas | Plastico". ATENCAO: 136 produtos divergem de main_category_id ' ||
  '(comportamento esperado para hierarquias). Ver BUG_AUDIT_20260526.md.';

COMMENT ON COLUMN public.products.main_category_id IS 
  'Categoria raiz/principal para navegacao (ex: "Canetas"). ' ||
  'Pode ser diferente de category_id para produtos em subcategorias. ' ||
  'Semantica oficial: category_id=folha, main_category_id=raiz.';

-- -------------------------------------------------------
-- VIEW DE MONITORAMENTO CONTÍNUO — v_db_health_audit
-- Permite detectar regressoes futuras nas mesmas falhas
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.v_db_health_audit
WITH (security_invoker = true)
AS
SELECT 
  'B02_quote_markup_nao_persistido' as check_id,
  count(*) as total_issues,
  'negotiation_markup_percent=0 mas total > subtotal sem frete/imposto/desconto' as descricao,
  'HIGH' as severidade
FROM public.quotes
WHERE 
  negotiation_markup_percent = 0
  AND total > subtotal
  AND ABS(COALESCE(shipping_cost,0)) < 0.01
  AND ABS(COALESCE(tax_amount,0)) < 0.01
  AND ABS(COALESCE(discount_amount,0)) < 0.01

UNION ALL

SELECT 
  'B04_produto_ativo_sem_preco',
  count(*),
  'Produto is_active=true sem cost_price nem sale_price',
  'MEDIUM'
FROM public.products
WHERE 
  cost_price IS NULL AND sale_price IS NULL 
  AND is_active = true 
  AND (is_deleted IS NULL OR is_deleted = false)

UNION ALL

SELECT 
  'B05_produto_category_inconsistente',
  count(*),
  'category_id != main_category_id (subcategoria vs raiz — verificar se esperado)',
  'INFO'
FROM public.products
WHERE 
  category_id IS NOT NULL AND main_category_id IS NOT NULL
  AND category_id != main_category_id

UNION ALL

SELECT
  'B03_smoke_test_runs_vazia',
  CASE WHEN (SELECT count(*) FROM public.smoke_test_runs) = 0 
       AND (SELECT count(*) FROM public.smoke_tests_runs) > 0 
       THEN 1 ELSE 0 END,
  'smoke_test_runs esta vazia; smoke_tests_runs tem ' || 
    (SELECT count(*)::text FROM public.smoke_tests_runs) || ' registros',
  'HIGH'

UNION ALL

SELECT
  'B06_quote_item_subtotal_formula',
  count(*),
  'subtotal != (unit_price * qty - discount + personalization_cost)',
  'CRITICAL'
FROM public.quote_items
WHERE ABS(
  subtotal - (
    unit_price * quantity 
    - COALESCE(discount_amount, 0) 
    + COALESCE(personalization_cost, 0)
  )
) > 0.01;

-- Permissoes (revogar de anon, permitir authenticated)
REVOKE ALL ON public.v_db_health_audit FROM anon;
GRANT SELECT ON public.v_db_health_audit TO authenticated;
