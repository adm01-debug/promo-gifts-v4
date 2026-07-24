-- Hardening do trigger de projecao: parse TYPE-SAFE de minAvgDailyDepletion7d.
-- Antes: (config->>'minAvgDailyDepletion7d')::numeric podia lancar 22P02 (invalid_text_representation)
--        para valores nao-numericos (string nao-numerica, boolean, objeto, array), abortando o UPDATE
--        legitimo de best_seller. Agora: so converte se for number JSON ou string que casa regex numerico;
--        qualquer outro valor cai no fallback 15. Nunca lanca 22P02.
-- fix_version=pbd_v1_1_20260627
CREATE OR REPLACE FUNCTION public.fn_pbd_project_intelligence_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE v_hot boolean; v_best_enabled boolean; v_best_min numeric; v_cfg jsonb;
BEGIN
  -- fix_version=pbd_v1_1_20260627 | ANTI-REGRESSAO: SECURITY DEFINER + SET search_path obrigatorios.
  -- Parse TYPE-SAFE de minAvgDailyDepletion7d: nunca lanca 22P02 em config arbitrario.
  IF COALESCE(NEW.badge_key, OLD.badge_key) NOT IN ('hot_item','best_seller') THEN RETURN NULL; END IF;
  SELECT is_enabled INTO v_hot FROM public.product_badge_definitions WHERE badge_key='hot_item';
  SELECT is_enabled, config INTO v_best_enabled, v_cfg FROM public.product_badge_definitions WHERE badge_key='best_seller';
  v_best_min := CASE
    WHEN jsonb_typeof(v_cfg->'minAvgDailyDepletion7d')='number'
      THEN (v_cfg->>'minAvgDailyDepletion7d')::numeric
    WHEN jsonb_typeof(v_cfg->'minAvgDailyDepletion7d')='string'
         AND (v_cfg->>'minAvgDailyDepletion7d') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (v_cfg->>'minAvgDailyDepletion7d')::numeric
    ELSE NULL END;
  INSERT INTO public.admin_settings(key, value, updated_at)
  VALUES ('intelligence_badges', jsonb_build_object(
            'hotItem',    jsonb_build_object('enabled', COALESCE(v_hot, true)),
            'bestSeller', jsonb_build_object('enabled', COALESCE(v_best_enabled, true), 'minAvgDailyDepletion7d', COALESCE(v_best_min, 15))
          ), now())
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();
  RETURN NULL;
END;$fn$;

COMMENT ON FUNCTION public.fn_pbd_project_intelligence_settings() IS 'fix_version=pbd_v1_1_20260627. Projeta hot_item/best_seller para admin_settings.intelligence_badges (compat ProductCard). Parse type-safe de minAvgDailyDepletion7d (nunca lanca 22P02 em config arbitrario; fallback 15).';
