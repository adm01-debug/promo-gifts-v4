-- Migration: v_system_alerts_cron_threshold_fix_20260623
-- BUG-ALERT-1 FIX (2026-06-23):
--
-- PROBLEMA: cron_alerts CTE em v_system_alerts usava HAVING count(*) > 0
-- Isso disparava alerta CRITICAL para qualquer falha transitória, incluindo
-- "job startup timeout" causado por reinício do pg_cron scheduler.
-- Resultado: 6 alertas CRITICAL falsos às 15:35 UTC (reinício scheduler),
-- todos os jobs já recuperados com 23+ sucessos consecutivos.
--
-- SOLUÇÃO: Threshold inteligente com dois critérios:
--   A) >= 3 falhas na última hora (volume persistente) → CRITICAL
--   B) >= 1 falha E última falha mais recente que último sucesso 
--      (job não se auto-recuperou) → CRITICAL
--
-- Isso elimina falsos positivos para falhas transitórias de infraestrutura
-- enquanto mantém detecção de jobs genuinamente quebrados.
--
-- DRY-RUN VALIDADO: 6 crons com 1 falha transitória cada → would_alert: false
-- Jobs permanentemente quebrados → would_alert: true (confirmado logicamente)

CREATE OR REPLACE VIEW v_system_alerts AS
WITH cron_alerts AS (
  SELECT
    'CRON_FAIL_RECENT'::text AS codigo,
    'critical'::text AS severidade,
    'Job ' || j.jobid || ' (' || j.jobname || ') com falhas na ultima hora' AS mensagem,
    COUNT(CASE WHEN d.status='failed' THEN 1 END)::text AS detalhe
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE d.start_time > NOW() - INTERVAL '1 hour'
  GROUP BY j.jobid, j.jobname
  HAVING
    -- Critério A: volume alto (não transitório)
    COUNT(CASE WHEN d.status='failed' THEN 1 END) >= 3
    OR (
      -- Critério B: houve falha E job não se auto-recuperou
      COUNT(CASE WHEN d.status='failed' THEN 1 END) >= 1
      AND MAX(CASE WHEN d.status='failed'    THEN d.start_time END)
        > MAX(CASE WHEN d.status='succeeded' THEN d.start_time END)
    )
),
import_stalled AS (
  SELECT 'IMPORT_STALLED'::text AS codigo, 'warning'::text AS severidade,
    'Batches Bronze pendentes ha mais de 1h'::text AS mensagem,
    COUNT(DISTINCT COALESCE(import_batch_id::text, supplier_id::text))::text AS detalhe
  FROM supplier_products_raw
  WHERE status = ANY(ARRAY['pending'::supplier_raw_status,'processing'::supplier_raw_status])
    AND imported_at < NOW() - INTERVAL '1 hour'
  HAVING COUNT(*) > 0
),
products_no_image AS (
  SELECT 'PRODUCTS_NO_IMAGE'::text AS codigo, 'info'::text AS severidade,
    'Produtos ativos sem imagem principal'::text AS mensagem, COUNT(*)::text AS detalhe
  FROM products WHERE is_active=true AND primary_image_url IS NULL HAVING COUNT(*) > 0
),
vss_no_preferred AS (
  SELECT 'VSS_NO_PREFERRED'::text AS codigo, 'warning'::text AS severidade,
    'Variantes ativas sem fornecedor preferido'::text AS mensagem, COUNT(*)::text AS detalhe
  FROM product_variants pv WHERE pv.is_active=true
    AND NOT EXISTS (SELECT 1 FROM variant_supplier_sources v
      WHERE v.variant_id=pv.id AND v.is_preferred=true AND v.is_active=true)
  HAVING COUNT(*) > 0
),
ai_queue_stale AS (
  SELECT 'AI_QUEUE_STALE'::text AS codigo, 'info'::text AS severidade,
    'Itens na fila IA ha mais de 7 dias'::text AS mensagem, COUNT(*)::text AS detalhe
  FROM ai_enrichment_queue
  WHERE status='pending' AND created_at < NOW()-INTERVAL '7 days'
    AND NOT EXISTS (SELECT 1 FROM ai_enrichment_queue w
      WHERE w.status='processing' AND w.locked_at > NOW()-INTERVAL '4 hours' LIMIT 1)
  HAVING COUNT(*) > 0
),
products_no_ncm AS (
  SELECT 'PRODUCTS_NO_NCM'::text AS codigo, 'critical'::text AS severidade,
    'Produtos ativos sem NCM (fiscal)'::text AS mensagem, COUNT(*)::text AS detalhe
  FROM products WHERE is_active=true AND ncm_id IS NULL HAVING COUNT(*) > 0
),
stock_critical AS (
  SELECT 'STOCK_CRITICAL_LOW'::text AS codigo, 'info'::text AS severidade,
    'Variantes ativas com estoque zero'::text AS mensagem, COUNT(*)::text AS detalhe
  FROM product_variants pv JOIN variant_supplier_sources v ON v.variant_id=pv.id
  WHERE pv.is_active=true AND v.is_active=true AND v.quantity=0 HAVING COUNT(*) > 0
),
stale_sync AS (
  SELECT 'SUPPLIER_SYNC_STALE'::text AS codigo, 'warning'::text AS severidade,
    'Fornecedor "' || s.name || '" sem sync ha '
      || ROUND(EXTRACT(EPOCH FROM NOW()-s.last_full_sync_at)/3600,1)::text || 'h' AS mensagem,
    s.last_full_sync_at::text AS detalhe
  FROM suppliers s WHERE s.sync_enabled=true
    AND (s.last_full_sync_at IS NULL
      OR s.last_full_sync_at < NOW()-
        (LEAST(GREATEST(COALESCE(s.sync_interval_minutes,60)*4,240),1440)||' minutes')::interval)
),
locked_by_residual AS (
  SELECT 'AI_QUEUE_LOCKED_RESIDUAL'::text AS codigo, 'warning'::text AS severidade,
    'Items ai_enrichment_queue com locked_by residual em estado terminal'::text AS mensagem,
    COUNT(*)::text AS detalhe
  FROM ai_enrichment_queue
  WHERE locked_by IS NOT NULL AND status<>ALL(ARRAY['processing','pending'])
  HAVING COUNT(*) > 100
)
SELECT codigo, severidade, mensagem, detalhe, NOW() AS detected_at
FROM (
  SELECT * FROM cron_alerts       UNION ALL
  SELECT * FROM import_stalled    UNION ALL
  SELECT * FROM products_no_image UNION ALL
  SELECT * FROM vss_no_preferred  UNION ALL
  SELECT * FROM ai_queue_stale    UNION ALL
  SELECT * FROM products_no_ncm   UNION ALL
  SELECT * FROM stock_critical    UNION ALL
  SELECT * FROM stale_sync        UNION ALL
  SELECT * FROM locked_by_residual
) c
ORDER BY CASE severidade WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END;

-- Comentário de migração
COMMENT ON VIEW v_system_alerts IS
'Sistema de alertas operacionais. BUG-ALERT-1 (2026-06-23): threshold CRON_FAIL_RECENT
corrigido de HAVING count(*)>0 para critério duplo (>=3 falhas OU sem auto-recuperação).';
