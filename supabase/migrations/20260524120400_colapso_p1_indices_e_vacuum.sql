-- Migration: P1.1 — FK sem cobertura
-- Advisor: 0001_unindexed_foreign_keys
-- collection_products.product_id (constraint collection_products_product_id_fkey1) sem índice.
-- Aplicada em produção em 2026-05-24.

CREATE INDEX IF NOT EXISTS idx_collection_products_product_id
  ON public.collection_products(product_id);
