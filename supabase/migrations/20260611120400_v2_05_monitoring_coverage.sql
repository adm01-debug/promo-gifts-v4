-- V2-05 — Monitoramento de cobertura do pipeline (anti-decay).
-- Motivação: as melhorias V1 decaíram silenciosamente porque eram UPDATEs
-- retroativos sem guarda. Agora as funções corrigem na FONTE e este monitor
-- detecta qualquer drift: view ao vivo + snapshot diário + checagem de regressão.

CREATE OR REPLACE VIEW public.vw_medallion_coverage AS
SELECT
  s.name AS fornecedor,
  'silver' AS camada,
  COUNT(*) AS produtos,
  ROUND(100.0*SUM(CASE WHEN NULLIF(TRIM(pp.ncm_code),'') IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*),1) AS ncm_pct,
  ROUND(100.0*SUM(CASE WHEN jsonb_array_length(COALESCE(pp.materials,'[]'::jsonb))>0 THEN 1 ELSE 0 END)/COUNT(*),1) AS materials_pct,
  ROUND(100.0*SUM(CASE WHEN jsonb_array_length(COALESCE(pp.tags,'[]'::jsonb))>0 THEN 1 ELSE 0 END)/COUNT(*),1) AS tags_pct,
  ROUND(100.0*SUM(CASE WHEN COALESCE(array_length(pp.meta_keywords,1),0)>0 THEN 1 ELSE 0 END)/COUNT(*),1) AS meta_pct,
  ROUND(100.0*SUM(CASE WHEN pp.ipi_rate IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*),1) AS ipi_pct,
  ROUND(100.0*SUM(CASE WHEN NULLIF(TRIM(pp.description),'') IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*),1) AS description_pct,
  NULL::numeric AS category_pct,
  NULL::numeric AS display_name_pct
FROM public.produtos_padronizacao pp JOIN public.suppliers s ON s.id=pp.supplier_id
GROUP BY s.name
UNION ALL
SELECT
  s.name, 'gold', COUNT(*),
  ROUND(100.0*SUM(CASE WHEN NULLIF(TRIM(p.ncm_code),'') IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*),1),
  ROUND(100.0*SUM(CASE WHEN jsonb_array_length(COALESCE(p.materials,'[]'::jsonb))>0
                        OR EXISTS (SELECT 1 FROM public.product_materials pm WHERE pm.product_id=p.id) THEN 1 ELSE 0 END)/COUNT(*),1),
  ROUND(100.0*SUM(CASE WHEN jsonb_array_length(COALESCE(p.tags,'[]'::jsonb))>0 THEN 1 ELSE 0 END)/COUNT(*),1),
  ROUND(100.0*SUM(CASE WHEN COALESCE(array_length(p.meta_keywords,1),0)>0 THEN 1 ELSE 0 END)/COUNT(*),1),
  ROUND(100.0*SUM(CASE WHEN p.ipi_rate IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*),1),
  ROUND(100.0*SUM(CASE WHEN NULLIF(TRIM(p.description),'') IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*),1),
  ROUND(100.0*SUM(CASE WHEN p.category_id IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*),1),
  ROUND(100.0*SUM(CASE WHEN p.name IS NULL OR p.name <> public.fn_normalize_product_name(p.name) OR p.name !~ '[A-Za-zÀ-ú]{4,}' THEN 1 ELSE 0 END)/COUNT(*),1)
FROM public.products p JOIN public.suppliers s ON s.id=p.supplier_id
GROUP BY s.name;

CREATE TABLE IF NOT EXISTS public.medallion_coverage_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  fornecedor text NOT NULL,
  camada text NOT NULL,
  produtos int NOT NULL,
  ncm_pct numeric, materials_pct numeric, tags_pct numeric, meta_pct numeric,
  ipi_pct numeric, description_pct numeric, category_pct numeric, display_name_pct numeric
);
CREATE INDEX IF NOT EXISTS idx_mcs_captured ON public.medallion_coverage_snapshots (captured_at);

ALTER TABLE public.medallion_coverage_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY mcs_admin_read ON public.medallion_coverage_snapshots
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.fn_snapshot_medallion_coverage()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  INSERT INTO public.medallion_coverage_snapshots
    (fornecedor, camada, produtos, ncm_pct, materials_pct, tags_pct, meta_pct, ipi_pct, description_pct, category_pct, display_name_pct)
  SELECT fornecedor, camada, produtos, ncm_pct, materials_pct, tags_pct, meta_pct, ipi_pct, description_pct, category_pct, display_name_pct
  FROM public.vw_medallion_coverage;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_check_coverage_regression()
RETURNS TABLE (fornecedor text, camada text, metrica text, maximo_7d numeric, atual numeric, queda_pp numeric)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $function$
  WITH hist AS (
    SELECT fornecedor, camada,
           MAX(ncm_pct) ncm, MAX(materials_pct) mat, MAX(tags_pct) tags, MAX(meta_pct) meta,
           MAX(ipi_pct) ipi, MAX(description_pct) descr, MAX(category_pct) cat, MAX(display_name_pct) disp
    FROM public.medallion_coverage_snapshots
    WHERE captured_at > now() - interval '7 days'
    GROUP BY fornecedor, camada
  ), atual AS (
    SELECT * FROM public.vw_medallion_coverage
  ), unioned AS (
    SELECT a.fornecedor, a.camada, m.metrica, m.maximo, m.val
    FROM atual a JOIN hist h ON h.fornecedor=a.fornecedor AND h.camada=a.camada
    CROSS JOIN LATERAL (VALUES
      ('ncm', h.ncm, a.ncm_pct), ('materials', h.mat, a.materials_pct),
      ('tags', h.tags, a.tags_pct), ('meta', h.meta, a.meta_pct),
      ('ipi', h.ipi, a.ipi_pct), ('description', h.descr, a.description_pct),
      ('category', h.cat, a.category_pct), ('display_name', h.disp, a.display_name_pct)
    ) m(metrica, maximo, val)
  )
  SELECT fornecedor, camada, metrica, maximo, val, ROUND(maximo - val, 1)
  FROM unioned
  WHERE maximo IS NOT NULL AND val IS NOT NULL AND maximo - val > 2.0
  ORDER BY (maximo - val) DESC;
$function$;

DO $$ BEGIN
  PERFORM cron.schedule('medallion-coverage-daily', '37 3 * * *',
    'SELECT public.fn_snapshot_medallion_coverage()');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
