-- M5: v_products_ai_coverage — monitoramento AI por fornecedor
CREATE OR REPLACE VIEW public.v_products_ai_coverage AS
SELECT s.name AS supplier_name, COUNT(p.id) AS total_products,
  COUNT(p.id) FILTER (WHERE p.ai_description IS NOT NULL AND length(p.ai_description)>20) AS com_ai_desc,
  ROUND(100.0*COUNT(p.id) FILTER (WHERE p.ai_description IS NOT NULL AND length(p.ai_description)>20)/NULLIF(COUNT(p.id),0),1) AS pct_ai_desc,
  MAX(p.ai_generated_at) AS last_ai_generated,
  COUNT(q.id) FILTER (WHERE q.status='pending') AS queue_pending,
  COUNT(q.id) FILTER (WHERE q.status='processing') AS queue_processing,
  COUNT(q.id) FILTER (WHERE q.status='done') AS queue_done,
  COUNT(q.id) FILTER (WHERE q.status='error') AS queue_error
FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
LEFT JOIN ai_enrichment_queue q ON q.product_id=p.id
WHERE p.is_active=true GROUP BY s.name ORDER BY total_products DESC;
GRANT SELECT ON public.v_products_ai_coverage TO authenticated;
