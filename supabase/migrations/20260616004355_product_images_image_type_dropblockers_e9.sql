-- ============================================================================
-- E9: vw_image_type_dropblockers — catálogo de objetos que bloqueiam
-- DROP COLUMN image_type de product_images.
-- Pré-requisito para migração gradual de image_type (texto) → image_type_id (FK).
-- Resultado: 52 funções + 14 triggers = 66 objetos mapeados.
-- ============================================================================

DROP VIEW IF EXISTS public.vw_image_type_dropblockers;

CREATE VIEW public.vw_image_type_dropblockers
WITH (security_invoker = true) AS
WITH
fn_refs AS (
  SELECT
    p.proname  AS object_name,
    'function' AS object_type,
    n.nspname  AS schema_name,
    'Referencia image_type no corpo da função' AS blocker_reason
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosrc ILIKE '%image_type%'
),
trg_refs AS (
  SELECT
    t.tgname   AS object_name,
    'trigger'  AS object_type,
    'public'   AS schema_name,
    'Trigger em product_images — pode ler/escrever image_type' AS blocker_reason
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'product_images'
    AND n.nspname = 'public'
    AND NOT t.tgisinternal
),
view_refs AS (
  SELECT
    c.relname  AS object_name,
    CASE c.relkind WHEN 'v' THEN 'view' ELSE 'matview' END AS object_type,
    n.nspname  AS schema_name,
    'View/MatView com dependência em product_images.image_type' AS blocker_reason
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_depend d ON d.objid = c.oid
  JOIN pg_class dep_class ON dep_class.oid = d.refobjid
  JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid AND a.attname = 'image_type'
  WHERE dep_class.relname = 'product_images'
    AND c.relkind IN ('v', 'm')
    AND n.nspname = 'public'
)
SELECT object_type, schema_name, object_name, blocker_reason
FROM fn_refs
UNION ALL
SELECT object_type, schema_name, object_name, blocker_reason
FROM trg_refs
UNION ALL
SELECT object_type, schema_name, object_name, blocker_reason
FROM view_refs
ORDER BY object_type, object_name;

REVOKE ALL ON public.vw_image_type_dropblockers FROM anon, authenticated;
GRANT SELECT ON public.vw_image_type_dropblockers TO service_role;

COMMENT ON VIEW public.vw_image_type_dropblockers IS
'Catálogo de todos os objetos que impedem DROP COLUMN image_type de product_images.
Use para planejar a migração gradual de image_type (texto) para image_type_id (FK).
Atualizado automaticamente via CREATE OR REPLACE VIEW (sem estado).
Acesso: service_role only.';
