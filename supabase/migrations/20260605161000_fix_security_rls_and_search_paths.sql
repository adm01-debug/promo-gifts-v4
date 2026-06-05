
-- ════════════════════════════════════════════════════════════════
-- Security fixes — resolves 4 ERROR + 5 WARN advisors:
--   ERROR: RLS disabled on produtos_padronizacao_variantes
--   ERROR: RLS disabled on _backup_produtos_padronizacao_20260604
--   WARN (×5): mutable search_path on utility functions
-- ════════════════════════════════════════════════════════════════

-- ── 1. RLS on produtos_padronizacao_variantes ────────────────
ALTER TABLE public.produtos_padronizacao_variantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY pad_var_authenticated_read
  ON public.produtos_padronizacao_variantes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY pad_var_service_all
  ON public.produtos_padronizacao_variantes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 2. RLS on backup table (admin/service only) ──────────────
ALTER TABLE public._backup_produtos_padronizacao_20260604 ENABLE ROW LEVEL SECURITY;

CREATE POLICY backup_pad_service_only
  ON public._backup_produtos_padronizacao_20260604
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. Fix mutable search_path — fn_log_price_change ────────
CREATE OR REPLACE FUNCTION public.fn_log_price_change()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

-- ── 4. Fix mutable search_path — fn_safe_int ────────────────
CREATE OR REPLACE FUNCTION public.fn_safe_int(p text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE v numeric;
BEGIN
  IF p IS NULL OR TRIM(p)='' THEN RETURN NULL; END IF;
  v := replace(TRIM(p), ',', '.')::numeric;
  RETURN trunc(v)::integer;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$function$;

-- ── 5. Fix mutable search_path — fn_safe_num ────────────────
CREATE OR REPLACE FUNCTION public.fn_safe_num(p text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF p IS NULL OR TRIM(p)='' THEN RETURN NULL; END IF;
  RETURN replace(TRIM(p), ',', '.')::numeric;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$function$;

-- ── 6. Fix mutable search_path — fn_derive_parent_ref ───────
CREATE OR REPLACE FUNCTION public.fn_derive_parent_ref(
  p_supplier_id uuid, p_variant_ref text, p_raw jsonb
)
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $function$
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
$function$;

-- ── 7. Fix mutable search_path — fn_extract_color_from_title
CREATE OR REPLACE FUNCTION public.fn_extract_color_from_title(p_titulo text)
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_tok text;
  v_up  text;
BEGIN
  IF p_titulo IS NULL OR TRIM(p_titulo)='' THEN RETURN NULL; END IF;
  v_up := UPPER(p_titulo);

  SELECT m[1] INTO v_tok FROM regexp_matches(v_up,
    '\y(PRET[AO]|BRANC[AO]|AZUL|VERMELH[AO]|VERDE|CINZA|AMAREL[AO]|ROSA|ROX[AO]|LARANJA|BEGE|MARROM|DOURAD[AO]|PRATEAD[AO]|PRATA|NATURAL|BAMBU|MADEIRA|INOX|VINHO|CAQUI|NUDE|TURQUESA|LIL[AÁ]S|FUM[EÊ]|TRANSPARENTE|GRAFITE|CHUMBO|CORAL|MOSTARDA)\y'
  ) m LIMIT 1;

  IF v_tok IS NULL THEN RETURN NULL; END IF;

  RETURN CASE
    WHEN v_tok LIKE 'PRET%'    THEN 'Preto'
    WHEN v_tok LIKE 'BRANC%'   THEN 'Branco'
    WHEN v_tok LIKE 'VERMELH%' THEN 'Vermelho'
    WHEN v_tok LIKE 'AMAREL%'  THEN 'Amarelo'
    WHEN v_tok LIKE 'ROX%'     THEN 'Roxo'
    WHEN v_tok LIKE 'DOURAD%'  THEN 'Dourado'
    WHEN v_tok LIKE 'PRATEAD%' THEN 'Prata'
    WHEN v_tok='AZUL'          THEN 'Azul'
    WHEN v_tok='VERDE'         THEN 'Verde'
    WHEN v_tok='CINZA'         THEN 'Cinza'
    WHEN v_tok='ROSA'          THEN 'Rosa'
    WHEN v_tok='LARANJA'       THEN 'Laranja'
    WHEN v_tok='BEGE'          THEN 'Bege'
    WHEN v_tok='MARROM'        THEN 'Marrom'
    WHEN v_tok='PRATA'         THEN 'Prata'
    WHEN v_tok='NATURAL'       THEN 'Natural'
    WHEN v_tok='BAMBU'         THEN 'Bambu'
    WHEN v_tok='MADEIRA'       THEN 'Madeira'
    WHEN v_tok='INOX'          THEN 'Inox'
    WHEN v_tok='VINHO'         THEN 'Vinho'
    WHEN v_tok='CAQUI'         THEN 'Caqui'
    WHEN v_tok='NUDE'          THEN 'Nude'
    WHEN v_tok='TURQUESA'      THEN 'Turquesa'
    WHEN v_tok LIKE 'LIL%'     THEN 'Lilás'
    WHEN v_tok LIKE 'FUM%'     THEN 'Fumê'
    WHEN v_tok='TRANSPARENTE'  THEN 'Transparente'
    WHEN v_tok='GRAFITE'       THEN 'Grafite'
    WHEN v_tok='CHUMBO'        THEN 'Chumbo'
    WHEN v_tok='CORAL'         THEN 'Coral'
    WHEN v_tok='MOSTARDA'      THEN 'Mostarda'
    ELSE initcap(v_tok)
  END;
END;
$function$;
