-- Melhoria 9: is_deleted hardening + índice parcial
COMMENT ON COLUMN public.products.is_deleted IS 'Soft-delete flag. 0 registros com true após cleanup 2026-06-23. NÃO adicionar CHECK=false: trigger usa true para marcar antes de cascade.';
COMMENT ON COLUMN public.products.deleted_at IS 'Timestamp soft-delete. 0 registros preenchidos após cleanup 2026-06-23.';
CREATE INDEX IF NOT EXISTS idx_products_active_not_deleted ON public.products(id) WHERE is_active=true AND is_deleted IS NOT TRUE;