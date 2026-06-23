-- Índices de performance identificados durante auditoria (2026-06-23)
-- Ambos já aplicados via Supabase dashboard. Migration para rastreabilidade.

CREATE INDEX IF NOT EXISTS idx_oq_status_priority
ON public.optimization_queue (status, priority ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_dar_seller_status
ON public.discount_approval_requests (seller_id, status)
WHERE (status = 'pending');
