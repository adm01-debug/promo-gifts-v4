
-- Asia: a ingestão (explode+achata) perdeu o `referencia` do PAI; sobrou só a
-- variação. Reconstrução heurística do pai a partir do padrão observado no gold:
--   variação multi-cor (tem hífen, ex CM0165-AZ) -> pai = corte de hífen (CM0165)
--   variação cor-única  (sem hífen, ex MC580)    -> pai = ref + 'P' (MC580P)
-- Realinha 417/436 do gold (órfãos 184->19). DEFINITIVO: re-ingerir de
-- listarProdutos2 preservando o `referencia` do pai (campo autoritativo).
CREATE OR REPLACE FUNCTION public.fn_derive_parent_ref(p_supplier_id uuid, p_variant_ref text, p_raw jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_variant_ref IS NULL OR TRIM(p_variant_ref) = '' THEN
    RETURN NULL;
  END IF;

  -- Spot: referência-pai explícita no raw
  IF p_supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0' THEN
    RETURN COALESCE(NULLIF(TRIM(p_raw->>'ProdReference'), ''), p_variant_ref);
  END IF;

  -- XBZ: família explícita (CodigoAmigavel) — autoritativa da API
  IF p_supplier_id = 'd6718a29-e954-4c1b-bd84-03ea24884900' THEN
    RETURN COALESCE(NULLIF(TRIM(p_raw->>'CodigoAmigavel'), ''), regexp_replace(p_variant_ref, '-[^-]*$', ''));
  END IF;

  -- Asia: reconstrução heurística do pai (referencia do pai perdida na ingestão)
  IF p_supplier_id = 'd2734e23-d633-4819-bb15-e51aa44e2118' THEN
    IF position('-' IN p_variant_ref) > 0 THEN
      RETURN regexp_replace(p_variant_ref, '-[^-]*$', '');
    ELSE
      RETURN p_variant_ref || 'P';
    END IF;
  END IF;

  -- Só Marcas: 1:1 — o código é o produto inteiro (hífen NÃO separa cor)
  IF p_supplier_id = '841cd690-210a-422a-908c-7676828db272' THEN
    RETURN p_variant_ref;
  END IF;

  -- demais: parte antes do ÚLTIMO hífen; sem hífen = é o próprio pai
  IF position('-' IN p_variant_ref) > 0 THEN
    RETURN regexp_replace(p_variant_ref, '-[^-]*$', '');
  END IF;
  RETURN p_variant_ref;
END;
$$;
