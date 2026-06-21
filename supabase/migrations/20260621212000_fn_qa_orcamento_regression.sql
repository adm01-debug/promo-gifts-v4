-- APLICADO 2026-06-21 (Supabase MCP execute_sql, projeto doufsxqlfjyuvxuezpln).
-- Rede de regressao permanente do modulo "Novo Orcamento": valida o invariante de que a
-- criacao resolve a organizacao server-side (omitida/fantasma/nao-membro -> canonica) e
-- rejeita com 23502 quem nao tem org. Cada cenario e revertido (savepoint). Restrita a service_role.
-- Uso: SELECT * FROM public.fn_qa_orcamento_regression();
CREATE OR REPLACE FUNCTION public.fn_qa_orcamento_regression()
RETURNS TABLE(cenario text, pass boolean, detalhe text)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  ADMIN constant uuid := '75921d8b-611f-4413-9ce5-afccdb733d26';
  CANON constant uuid := '5db5aee1-064b-4ef4-9193-345dcd8274ea';
  r public.quotes; v_pass boolean; v_det text;
  specs jsonb := $j$[
    {"d":"org OMITIDA resolve canonica","q":{"client_name":"QA","subtotal":10,"total":10}},
    {"d":"org FANTASMA resolve canonica","q":{"client_name":"QA","organization_id":"35c6a2a6-5d6d-4ddb-8dbd-8e842a0118e5","subtotal":10,"total":10}},
    {"d":"org nao-membro resolve canonica","q":{"client_name":"QA","organization_id":"11111111-1111-1111-1111-111111111111","subtotal":10,"total":10}}
  ]$j$::jsonb;
  spec jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',ADMIN,'role','authenticated')::text, true);
  FOR spec IN SELECT * FROM jsonb_array_elements(specs) LOOP
    v_pass := false; v_det := '';
    BEGIN
      r := public.create_quote_transactional(spec->'q',
            jsonb_build_array(jsonb_build_object('product_name','P','quantity',1,'unit_price',10,'subtotal',10)));
      v_pass := (r.organization_id = CANON AND r.created_by = ADMIN AND r.quote_number ~ '^[0-9]+/[0-9]{2}$');
      v_det := format('org=%s num=%s', r.organization_id, r.quote_number);
      RAISE EXCEPTION 'RBK';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'RBK' THEN v_pass := false; v_det := 'ERRO: '||left(SQLERRM,80); END IF;
    END;
    cenario := spec->>'d'; pass := v_pass; detalhe := v_det; RETURN NEXT;
  END LOOP;
  v_pass := false; v_det := '';
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated')::text, true);
  BEGIN
    r := public.create_quote_transactional(jsonb_build_object('client_name','QA','subtotal',10,'total',10),
          jsonb_build_array(jsonb_build_object('product_name','P','quantity',1,'unit_price',10,'subtotal',10)));
    v_pass := false; v_det := 'FALHA: criou sem org '||r.quote_number; RAISE EXCEPTION 'RBK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE='23502' OR SQLERRM ILIKE '%organiza%' THEN v_pass := true; v_det := 'rejeitado 23502 (ok)';
    ELSIF SQLERRM='RBK' THEN NULL;
    ELSE v_pass := false; v_det := 'erro inesperado: '||left(SQLERRM,60); END IF;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',ADMIN,'role','authenticated')::text, true);
  cenario := 'NEGATIVO: usuario sem org -> 23502'; pass := v_pass; detalhe := v_det; RETURN NEXT;
  RETURN;
END;
$fn$;
REVOKE ALL ON FUNCTION public.fn_qa_orcamento_regression() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_qa_orcamento_regression() TO service_role;
