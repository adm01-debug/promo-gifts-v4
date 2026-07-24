-- V2-06 — Convergência retroativa (idempotente; todos os passos são fill-only).
-- Já executada em produção em 2026-06-11; mantida como migration para
-- reprodutibilidade em outros ambientes. Re-execução não altera dados corretos.

-- (1) Mapping XBZ IpiTaxa → ipi_rate (91.3% de cobertura no raw; estava sem mapping)
INSERT INTO supplier_field_mappings (supplier_id, source_field, target_table, target_field, transform_type, priority, is_active)
SELECT s.id, 'IpiTaxa', 'products', 'ipi_rate', 'cast_decimal', 28, TRUE
FROM suppliers s WHERE s.name='XBZ Brindes'
  AND NOT EXISTS (SELECT 1 FROM supplier_field_mappings m
                  WHERE m.supplier_id=s.id AND m.target_field='ipi_rate' AND m.target_table='products');

-- (2) IPI ← raw XBZ direto
UPDATE produtos_padronizacao pp
SET ipi_rate = public.fn_safe_num(r.raw_data->>'IpiTaxa'), updated_at = now()
FROM supplier_products_raw r
WHERE r.id = pp.raw_id AND pp.ipi_rate IS NULL
  AND public.fn_safe_num(r.raw_data->>'IpiTaxa') IS NOT NULL;

-- (3) IPI ← ncm_codes
UPDATE produtos_padronizacao pp
SET ipi_rate = nc.ipi_rate, updated_at = now()
FROM ncm_codes nc
WHERE pp.ipi_rate IS NULL AND nc.code = pp.ncm_code AND nc.is_active AND nc.ipi_rate IS NOT NULL;

-- (4) IPI ← moda inequívoca dos irmãos de mesmo NCM
WITH moda AS (
  SELECT ncm_code, MIN(ipi_rate) AS ipi FROM produtos_padronizacao
  WHERE ipi_rate IS NOT NULL AND ncm_code IS NOT NULL
  GROUP BY ncm_code HAVING COUNT(DISTINCT ipi_rate)=1
)
UPDATE produtos_padronizacao pp SET ipi_rate=m.ipi, updated_at=now()
FROM moda m WHERE pp.ipi_rate IS NULL AND pp.ncm_code=m.ncm_code;

-- (5) NCM ← prefixo de nome inequívoco (2 primeiras palavras, mesmo fornecedor)
WITH alvo AS (
  SELECT id, supplier_id,
         (SELECT string_agg(w,' ') FROM (
            SELECT w FROM regexp_split_to_table(UPPER(name),'\s+') WITH ORDINALITY t(w,o) WHERE o<=2 ORDER BY o) z) AS prefix
  FROM produtos_padronizacao WHERE ncm_code IS NULL AND name IS NOT NULL
), mapa AS (
  SELECT a.id, MIN(x.ncm_code) AS ncm
  FROM alvo a
  JOIN produtos_padronizacao x ON x.supplier_id=a.supplier_id AND x.ncm_code IS NOT NULL
       AND UPPER(x.name) LIKE a.prefix || '%'
  WHERE LENGTH(a.prefix) >= 5
  GROUP BY a.id HAVING COUNT(DISTINCT x.ncm_code) = 1
)
UPDATE produtos_padronizacao pp SET ncm_code = m.ncm, updated_at = now()
FROM mapa m WHERE pp.id = m.id;

-- (6) Conteúdo (tags/materials/meta/description) via fn_enrich_padronizacao
SELECT COUNT(*) FROM (
  SELECT public.fn_enrich_padronizacao(pp.id)
  FROM produtos_padronizacao pp
  WHERE jsonb_array_length(COALESCE(pp.tags,'[]'::jsonb))=0
     OR jsonb_array_length(COALESCE(pp.materials,'[]'::jsonb))=0
     OR COALESCE(array_length(pp.meta_keywords,1),0)=0
     OR NULLIF(TRIM(COALESCE(pp.description,'')),'') IS NULL
) t;

-- (7) Gold: nomes ALLCAPS-máquina → display-case
--     Auditoria prévia: 100% dos nomes lockados eram byte-idênticos à forma
--     máquina (UPPER) — zero conteúdo humano em risco; a transformação preserva
--     o conteúdo e muda apenas a caixa. Locks continuam respeitados no pipeline.
SELECT set_config('app.write_source','pipeline', true);
SELECT set_config('app.bulk_import_mode','true', true);
UPDATE products p
SET name = public.fn_display_product_name(p.name), updated_at = now()
WHERE p.name IS NOT NULL
  AND p.name = public.fn_normalize_product_name(p.name)
  AND p.name ~ '[A-Za-zÀ-ú]{4,}'
  AND public.fn_display_product_name(p.name) IS DISTINCT FROM p.name;

-- (8) Gold: enriquecimento fill-only a partir da Silver (locks respeitados por coluna)
UPDATE products p SET
  tags = CASE WHEN 'tags'=ANY(COALESCE(p.locked_fields,'{}')) THEN p.tags
              ELSE COALESCE(NULLIF(p.tags,'[]'::jsonb), NULLIF(pp.tags,'[]'::jsonb), p.tags) END,
  materials = CASE WHEN 'materials'=ANY(COALESCE(p.locked_fields,'{}')) THEN p.materials
              ELSE COALESCE(NULLIF(p.materials,'[]'::jsonb), NULLIF(pp.materials,'[]'::jsonb), p.materials) END,
  meta_keywords = CASE WHEN 'meta_keywords'=ANY(COALESCE(p.locked_fields,'{}')) THEN p.meta_keywords
              WHEN COALESCE(array_length(p.meta_keywords,1),0)=0 THEN COALESCE(pp.meta_keywords, p.meta_keywords)
              ELSE p.meta_keywords END,
  ipi_rate = CASE WHEN 'ipi_rate'=ANY(COALESCE(p.locked_fields,'{}')) THEN p.ipi_rate
              ELSE COALESCE(p.ipi_rate, pp.ipi_rate) END,
  ncm_code = CASE WHEN 'ncm_code'=ANY(COALESCE(p.locked_fields,'{}')) THEN p.ncm_code
              ELSE COALESCE(NULLIF(TRIM(p.ncm_code),''), NULLIF(pp.ncm_code,'00000000')) END,
  description = CASE WHEN 'description'=ANY(COALESCE(p.locked_fields,'{}')) THEN p.description
              ELSE COALESCE(NULLIF(TRIM(p.description),''), pp.description) END,
  updated_at = now()
FROM produtos_padronizacao pp
WHERE pp.product_id = p.id
  AND ( (jsonb_array_length(COALESCE(p.tags,'[]'::jsonb))=0 AND jsonb_array_length(COALESCE(pp.tags,'[]'::jsonb))>0)
     OR (jsonb_array_length(COALESCE(p.materials,'[]'::jsonb))=0 AND jsonb_array_length(COALESCE(pp.materials,'[]'::jsonb))>0)
     OR (COALESCE(array_length(p.meta_keywords,1),0)=0 AND COALESCE(array_length(pp.meta_keywords,1),0)>0)
     OR (p.ipi_rate IS NULL AND pp.ipi_rate IS NOT NULL)
     OR (NULLIF(TRIM(p.ncm_code),'') IS NULL AND pp.ncm_code IS NOT NULL)
     OR (NULLIF(TRIM(p.description),'') IS NULL AND pp.description IS NOT NULL) );

-- (9) Gold: categorias via cadeia (classify melhor confiança → residual), fill-only
WITH alvo AS (
  SELECT p.id, public.fn_promote_category_fallback(p.name) AS cat
  FROM products p
  WHERE p.category_id IS NULL AND NOT ('category_id' = ANY(COALESCE(p.locked_fields,'{}')))
)
UPDATE products p SET category_id = a.cat, updated_at = now()
FROM alvo a WHERE p.id = a.id AND a.cat IS NOT NULL;

-- (10) Higiene: NCM com pontos remanescente + dedup de variantes Silver
UPDATE produtos_padronizacao SET ncm_code = public.fn_normalize_ncm(ncm_code), updated_at=now()
WHERE ncm_code LIKE '%.%';

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY supplier_id, supplier_sku
    ORDER BY (variant_id IS NOT NULL) DESC, updated_at DESC, created_at DESC
  ) rn
  FROM produtos_padronizacao_variantes
  WHERE supplier_sku IN (
    SELECT supplier_sku FROM produtos_padronizacao_variantes
    WHERE supplier_sku IS NOT NULL GROUP BY supplier_id, supplier_sku HAVING COUNT(*)>1)
)
DELETE FROM produtos_padronizacao_variantes WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- (11) Snapshot baseline do monitoramento
SELECT public.fn_snapshot_medallion_coverage();
