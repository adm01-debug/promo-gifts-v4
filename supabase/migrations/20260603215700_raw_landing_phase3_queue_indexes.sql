
-- ════════════════════════════════════════════════════════════════
-- FASE 3 (parte segura) — índices da fila e da idempotência.
-- Índices PARCIAIS: indexam só o que está "quente" (pending/failed),
-- mantendo-se minúsculos mesmo com milhões de linhas processadas.
-- Nenhuma coluna é removida aqui (DROPs ficam gated em auditoria).
-- ════════════════════════════════════════════════════════════════

-- Fila de processamento: o worker pega o próximo pendente por ordem de chegada
CREATE INDEX IF NOT EXISTS idx_spr_queue
  ON public.supplier_products_raw (supplier_id, imported_at) WHERE status = 'pending';

-- Itens que falharam (para retry/monitoramento)
CREATE INDEX IF NOT EXISTS idx_spr_failed
  ON public.supplier_products_raw (supplier_id) WHERE status = 'failed';

-- Fila do pipeline de imagens (assíncrono, paralelo)
CREATE INDEX IF NOT EXISTS idx_spr_images_queue
  ON public.supplier_products_raw (supplier_id) WHERE images_status = 'pending';

-- Detecção de mudança / dedupe por conteúdo
CREATE INDEX IF NOT EXISTS idx_spr_content_hash
  ON public.supplier_products_raw (supplier_id, content_hash);
