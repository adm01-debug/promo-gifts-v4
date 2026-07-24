-- Melhoria 6: Fix formato NCM + COMMENT
SELECT set_config('app.write_source','pipeline',true);
UPDATE public.products SET ncm_code = '42022220' WHERE sku = 'ME188-06P' AND ncm_code = '4202.22.20';
UPDATE public.products SET ncm_code = '42029200' WHERE sku = 'MC650' AND ncm_code = '19.005.00';
SELECT set_config('app.write_source','ui',true);
COMMENT ON COLUMN public.products.ncm_code IS 'Código NCM fiscal 8 dígitos. trg_sync_ncm_id mantém ncm_code<->ncm_id sincronizados. 2026-06-23: 2 formatos inválidos corrigidos.';