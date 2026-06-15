-- ============================================================================
-- FIX SEV-1 (descoberto em teste adversarial de RLS)
-- ----------------------------------------------------------------------------
-- A policy de SELECT de product_images foi alterada pelo ambiente para
--   USING (is_active OR is_org_owner_or_admin(organization_id))
-- mas o papel `anon` NÃO tinha EXECUTE em is_org_owner_or_admin. Ao avaliar a RLS
-- sobre qualquer linha inativa, o anônimo recebia:
--   ERROR: permission denied for function is_org_owner_or_admin
-- e a query inteira falhava -> imagens quebravam no site público (RLS é security-qual,
-- avaliada antes do filtro da aplicação; basta 1 inativa no escopo).
--
-- is_org_owner_or_admin é SECURITY DEFINER e usa auth.uid(); para anon (uid nulo)
-- retorna false sem vazamento. Conceder EXECUTE ao anon corrige o erro e preserva a
-- intenção: anônimo vê só imagens ativas; inativas só para owner/admin da organização.
-- Fix estável: independe da expressão exata da policy (resiste à churn do ambiente).
-- Verificado: anon lê 73187 ativas, 0 inativas visíveis, escrita bloqueada.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_org_owner_or_admin(uuid) TO anon;
