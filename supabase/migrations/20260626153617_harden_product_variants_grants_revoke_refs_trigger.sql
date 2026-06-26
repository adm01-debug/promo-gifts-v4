-- Uniformiza o baseline de grants: remove REFERENCES/TRIGGER do authenticated em product_variants
-- (privilégios de CRIAR trigger/FK, que authenticated nunca deve exercer), consistente com o hardening
-- já aplicado em quotes, quote_approval_tokens e discount_approval_requests.
-- anon já estava correto (apenas SELECT, catálogo público). authenticated MANTÉM SELECT + INSERT/UPDATE/DELETE
-- (escrita gateada por RLS admin-only). service_role mantém ALL. Vitrine pública intacta (dry-run 7/7).
REVOKE REFERENCES, TRIGGER ON public.product_variants FROM authenticated;
