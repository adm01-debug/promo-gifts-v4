-- ═══════════════════════════════════════════════════════════════
-- Gate CI: check-403-sweep
-- ═══════════════════════════════════════════════════════════════
-- Detecta views/matviews de public que o PostgREST expõe mas que retornariam
-- 403 em runtime por falta de GRANT na dependência (security_invoker + sem
-- SELECT no dep). Cobre 2 níveis de profundidade.
--
-- CONTEXTO: o incidente de 403 em mv_stock_velocity aconteceu 2x (31/05 e
-- 17/07) porque migrations de hardening revogaram grants sem testar a cadeia.
-- Este script teria pego os 5 objetos quebrados no dia da migration.
--
-- COMO USAR:
--   npx supabase db execute --file scripts/check-403-sweep.sql
--   # Zero linhas = OK. Qualquer linha = gate falha.

WITH nivel1 AS (
  SELECT DISTINCT
    cv.oid AS v_oid, pv.nspname||'.'||cv.relname AS view_name,
    COALESCE(cv.reloptions @> ARRAY['security_invoker=true'], false) AS is_invoker,
    cd.oid AS d_oid, pd.nspname||'.'||cd.relname AS dep_name, cd.relkind::text AS dep_kind
  FROM pg_class cv JOIN pg_namespace pv ON pv.oid=cv.relnamespace
  JOIN pg_rewrite rw ON rw.ev_class=cv.oid
  JOIN pg_depend d ON d.objid=rw.oid AND d.classid='pg_rewrite'::regclass
  JOIN pg_class cd ON cd.oid=d.refobjid AND cd.relkind IN ('r','v','m','f','p')
  JOIN pg_namespace pd ON pd.oid=cd.relnamespace
  WHERE pv.nspname='public' AND cv.relkind IN ('v','m') AND cd.oid<>cv.oid
    AND pd.nspname NOT IN ('pg_catalog','information_schema')
    AND has_table_privilege('authenticated',cv.oid,'SELECT')
),
nivel2 AS (
  SELECT DISTINCT n1.v_oid, n1.view_name, n1.is_invoker,
    cd2.oid AS d_oid, pd2.nspname||'.'||cd2.relname AS dep_name, cd2.relkind::text AS dep_kind
  FROM nivel1 n1
  JOIN pg_rewrite rw2 ON rw2.ev_class=n1.d_oid
  JOIN pg_depend d2 ON d2.objid=rw2.oid AND d2.classid='pg_rewrite'::regclass
  JOIN pg_class cd2 ON cd2.oid=d2.refobjid AND cd2.relkind IN ('r','v','m','f','p')
  JOIN pg_namespace pd2 ON pd2.oid=cd2.relnamespace
  WHERE cd2.oid<>n1.d_oid AND pd2.nspname NOT IN ('pg_catalog','information_schema') AND n1.is_invoker
)
SELECT '403_CHAIN_BREAK' AS tipo, view_name, dep_name, dep_kind,
  'authenticated tem SELECT na view mas NÃO no dep (security_invoker)' AS detalhe
FROM nivel1
WHERE is_invoker AND NOT has_table_privilege('authenticated',d_oid,'SELECT')

UNION ALL

SELECT '403_CHAIN_BREAK_L2', view_name, dep_name, dep_kind,
  'cadeia nível 2: authenticated sem SELECT no dep do dep'
FROM nivel2
WHERE NOT has_table_privilege('authenticated',d_oid,'SELECT')

UNION ALL

SELECT 'MATVIEW_WRITE_LIXO', n.nspname||'.'||c.relname,
  CASE WHEN has_table_privilege('anon',c.oid,'INSERT') THEN 'anon' ELSE 'authenticated' END,
  c.relkind::text,
  'matview não é atualizável — grant de escrita é lixo perigoso'
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='m' AND n.nspname IN ('public','analytics','internal')
  AND (has_table_privilege('anon',c.oid,'INSERT') OR has_table_privilege('authenticated',c.oid,'INSERT')
    OR has_table_privilege('anon',c.oid,'UPDATE') OR has_table_privilege('authenticated',c.oid,'UPDATE'))

ORDER BY tipo, view_name;
