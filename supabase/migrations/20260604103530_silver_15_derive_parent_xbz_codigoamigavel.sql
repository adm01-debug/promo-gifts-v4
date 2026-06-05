
-- XBZ entrega a família/pai explícita em CodigoAmigavel (100% preenchido,
-- autoritativo da própria XBZ). Corrige sujeira (espaços) e trata SKUs que a
-- XBZ considera avulsos como avulsos (resolve os "órfãos" que o corte-de-hífen
-- agrupava errado). Fallback para o corte-de-hífen se faltar o campo.
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

  -- Só Marcas: 1:1 — o código é o produto inteiro (hífen NÃO separa cor)
  IF p_supplier_id = '841cd690-210a-422a-908c-7676828db272' THEN
    RETURN p_variant_ref;
  END IF;

  -- Asia / demais: parte antes do ÚLTIMO hífen; sem hífen = é o próprio pai
  IF position('-' IN p_variant_ref) > 0 THEN
    RETURN regexp_replace(p_variant_ref, '-[^-]*$', '');
  END IF;
  RETURN p_variant_ref;
END;
$$;
