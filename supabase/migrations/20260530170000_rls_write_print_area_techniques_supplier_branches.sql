-- ============================================================================
-- SUPERSEDED / NÃO APLICAR
-- ----------------------------------------------------------------------------
-- Esta migration (groundwork do Plano A) concedia escrita a print_area_techniques
-- via user_is_org_member (nível-membro) — o que permitiria VENDEDORES escreverem,
-- violando a regra "gestão != vendedor".
--
-- Foi SUPERADA por 20260530174500_etapa4_rls_harden_seller_management.sql, que
-- concede escrita a print_area_techniques E supplier_branches exigindo
-- is_org_owner_or_admin (owner/admin) via tabela-pai.
--
-- Conteúdo original removido de propósito para NÃO reabrir a brecha caso as
-- migrations sejam reaplicadas em ordem. No-op intencional.
-- ============================================================================

SELECT 1;
