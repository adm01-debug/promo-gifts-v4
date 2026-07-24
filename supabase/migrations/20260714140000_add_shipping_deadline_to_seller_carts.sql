-- ============================================================
-- BUG FIX: add shipping_deadline to seller_carts
-- Coluna referenciada no frontend (useSellerCarts.ts) desde 2026-07-13
-- mas nunca criada no banco canônico (migration do Lovable não foi aplicada).
-- Causa do BUG PGRST204 no console: fallback de restore tentava INSERT
-- com shipping_deadline e recebia 400 Bad Request.
-- ============================================================
ALTER TABLE public.seller_carts
  ADD COLUMN IF NOT EXISTS shipping_deadline date NULL;

COMMENT ON COLUMN public.seller_carts.shipping_deadline IS
  'Prazo p/ envio: data limite (DATE) para enviar o pedido ao cliente. Null quando não definido.';
