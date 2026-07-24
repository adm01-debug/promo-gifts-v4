-- ════════════════════════════════════════════════════════════════
-- UNIFICAÇÃO MEDALLION — Fase 3/4
-- Neutraliza os atalhos Bronze→Gold (violavam as 3 fases).
-- ════════════════════════════════════════════════════════════════
-- Chamadores verificados ao vivo:
--   fn_process_raw_v2            ← só fn_dryrun_raw_v2 (ferramenta dry-run)
--   process_supplier_product     ← só process_supplier_products_batch
--   process_supplier_products_batch ← nenhum chamador externo
-- Assinaturas preservadas (CREATE OR REPLACE) para não quebrar nada.
-- ════════════════════════════════════════════════════════════════

-- (1) Motor v2: redireciona para o pipeline de 3 fases (deixa de gravar Gold direto)
CREATE OR REPLACE FUNCTION public.fn_process_raw_v2(
    p_supplier_id uuid,
    p_batch_size  integer DEFAULT 100,
    p_bulk_mode   boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_std jsonb; v_prom jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_above((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil admin ou superior';
  END IF;
  -- REDIRECIONADO 2026-06-05: não grava mais Bronze→Gold direto.
  v_std  := public.fn_standardize_supplier(p_supplier_id, p_batch_size);  -- Bronze→Silver
  v_prom := public.fn_promote_supplier(p_supplier_id, NULL);              -- Silver→Gold
  RETURN jsonb_build_object(
    'success', true, 'redirected', true,
    'pipeline', 'fn_standardize_supplier + fn_promote_supplier',
    'supplier_id', p_supplier_id,
    'parents_processed',  COALESCE((v_prom->>'pais_promovidos')::int, 0),
    'variants_processed', COALESCE((v_prom->>'variantes_promovidas')::int, 0),
    'standardize', v_std, 'promote', v_prom);
END;
$function$;

COMMENT ON FUNCTION public.fn_process_raw_v2(uuid, integer, boolean) IS
  'DEPRECATED/REDIRECIONADA 2026-06-05: delega ao pipeline Medallion de 3 fases '
  '(fn_standardize_supplier + fn_promote_supplier). Não grava mais Bronze->Gold direto.';

-- (2) Writer ad-hoc Bronze→Gold: neutralizado (sem escrita no Gold)
CREATE OR REPLACE FUNCTION public.process_supplier_product(
    p_supplier_id uuid,
    p_raw_data jsonb,
    p_supplier_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- DEPRECATED 2026-06-05: gravava Bronze->Gold direto (pulava a Silver). Neutralizada.
  RETURN jsonb_build_object(
    'success', false, 'deprecated', true,
    'error', 'process_supplier_product descontinuada: use o pipeline Medallion '
             '(supplier_products_raw -> fn_standardize_supplier -> fn_promote_supplier)',
    'supplier_id', p_supplier_id, 'supplier_reference', p_supplier_reference);
END;
$function$;

COMMENT ON FUNCTION public.process_supplier_product(uuid, jsonb, text) IS
  'DEPRECATED 2026-06-05: writer Bronze->Gold direto neutralizado. Candidata a DROP em follow-up.';

-- (3) Batch legado: redireciona para o pipeline de 3 fases (preserva o shape de retorno)
CREATE OR REPLACE FUNCTION public.process_supplier_products_batch(
    p_supplier_id uuid,
    p_limit integer DEFAULT 100
)
RETURNS TABLE(staging_id uuid, supplier_reference text, success boolean,
              product_id uuid, variants_created integer, error_message text,
              processed_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_std jsonb; v_prom jsonb;
BEGIN
  -- REDIRECIONADO 2026-06-05: não usa mais process_supplier_product (Bronze->Gold direto).
  v_std  := public.fn_standardize_supplier(p_supplier_id, p_limit);  -- Bronze→Silver
  v_prom := public.fn_promote_supplier(p_supplier_id, NULL);         -- Silver→Gold

  staging_id         := NULL::uuid;
  supplier_reference := NULL::text;
  success            := COALESCE((v_prom->>'success')::boolean, false)
                        AND COALESCE((v_std->>'erros')::int, 0) = 0;
  product_id         := NULL::uuid;
  variants_created   := COALESCE((v_prom->>'variantes_promovidas')::integer, 0);
  error_message      := CASE WHEN success THEN NULL
                             ELSE 'erros no pipeline; ver fn_standardize_supplier/fn_promote_supplier' END;
  processed_at       := now();
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.process_supplier_products_batch(uuid, integer) IS
  'DEPRECATED/REDIRECIONADA 2026-06-05: delega ao pipeline Medallion 3 fases. Candidata a DROP em follow-up.';
