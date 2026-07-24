-- =================================================================
-- Onda 18a: Isolamento de orcamentos por vendedor (audit gap 6.1 redirecionado)
--
-- Regra de negocio (Joaquim PO):
--   - VENDEDOR/AGENTE: ve SO os PROPRIOS orcamentos (seller_id ou created_by ou assigned_to = self)
--   - SUPERVISOR/COORDENADOR: ve TODOS os orcamentos (via is_coord_or_above)
--   - ADMIN: ve tudo (incluido no is_coord_or_above por decisao Q1=A)
--   - DEV: ve tudo (incluido no is_coord_or_above)
--
-- Antes desta migration: qualquer membro da org via TODOS os orcamentos
-- (gap concreto: comercial03@/comercial05@ viam quotes do adm01@ que NAO eram suas)
--
-- Tabelas afetadas: quotes, quote_items, quote_comments, quote_versions
-- DELETE de quotes mantem is_org_owner_or_admin (controle org-level distinto)
-- INSERT de quotes mantem user_is_org_member (qualquer membro pode criar)
-- =================================================================

-- Replay guard: algumas bases historicas criaram public.quotes antes da coluna
-- assigned_to, mas esta migration e hardenings posteriores ja tratam ela como
-- parte do modelo oficial.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_assigned_to ON public.quotes (assigned_to);

-- 1. NOVA FUNCAO: can_access_quote(quote_id)
--    Encapsula logica em SSOT, SECURITY DEFINER pra evitar recursao RLS
CREATE OR REPLACE FUNCTION public.can_access_quote(_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = _quote_id
      AND user_is_org_member(q.organization_id)
      AND (
        is_coord_or_above(auth.uid())
        OR q.seller_id  = auth.uid()
        OR q.created_by = auth.uid()
        OR q.assigned_to = auth.uid()
      )
  );
$$;

COMMENT ON FUNCTION public.can_access_quote(uuid) IS
  'Onda 18a: SSOT para acesso a uma quote. Vendedor ve so as proprias (seller/created/assigned), supervisor+/admin/dev veem tudo.';

-- Privilege hardening: alinhado com padrao do projeto para SECURITY DEFINER functions
-- (search_products_semantic, get_connection_failure_window_minutes, etc).
-- Sem isso, Supabase concede EXECUTE para PUBLIC + anon por default.
-- rls-helper: can_access_quote é chamada por policies RLS de
-- quote_items/quote_comments/quote_versions. SECURITY DEFINER evita
-- recursão RLS quando policy de tabela dependente consulta quotes.
REVOKE EXECUTE ON FUNCTION public.can_access_quote(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_quote(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_quote(uuid) TO authenticated, service_role;

-- 2. QUOTES - SELECT + UPDATE
DROP POLICY IF EXISTS "org_members_view_quotes" ON public.quotes;
DROP POLICY IF EXISTS "quotes_select_scope" ON public.quotes;
CREATE POLICY "quotes_select_scope" ON public.quotes FOR SELECT
USING (
  user_is_org_member(organization_id) AND (
    is_coord_or_above(auth.uid())
    OR seller_id  = auth.uid()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "org_members_update_own_quotes" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update_scope" ON public.quotes;
CREATE POLICY "quotes_update_scope" ON public.quotes FOR UPDATE
USING (
  user_is_org_member(organization_id) AND (
    is_coord_or_above(auth.uid())
    OR seller_id  = auth.uid()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);

-- 3. QUOTE_ITEMS - SELECT + INSERT + UPDATE (DELETE mantem is_org_owner_or_admin)
DROP POLICY IF EXISTS "quote_items_select" ON public.quote_items;
CREATE POLICY "quote_items_select" ON public.quote_items FOR SELECT
USING (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "quote_items_insert" ON public.quote_items;
CREATE POLICY "quote_items_insert" ON public.quote_items FOR INSERT
WITH CHECK (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "quote_items_update" ON public.quote_items;
CREATE POLICY "quote_items_update" ON public.quote_items FOR UPDATE
USING (public.can_access_quote(quote_id));

-- 4. QUOTE_COMMENTS - SELECT + INSERT + UPDATE (DELETE mantem is_org_owner_or_admin)
DROP POLICY IF EXISTS "quote_comments_select" ON public.quote_comments;
CREATE POLICY "quote_comments_select" ON public.quote_comments FOR SELECT
USING (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "quote_comments_insert" ON public.quote_comments;
CREATE POLICY "quote_comments_insert" ON public.quote_comments FOR INSERT
WITH CHECK (public.can_access_quote(quote_id));

DROP POLICY IF EXISTS "quote_comments_update" ON public.quote_comments;
CREATE POLICY "quote_comments_update" ON public.quote_comments FOR UPDATE
USING (public.can_access_quote(quote_id));

-- 5. QUOTE_VERSIONS - SELECT (INSERT mantem qv_insert_service para service_role)
DROP POLICY IF EXISTS "org_members_view_quote_versions" ON public.quote_versions;
DROP POLICY IF EXISTS "quote_versions_select_scope" ON public.quote_versions;
CREATE POLICY "quote_versions_select_scope" ON public.quote_versions FOR SELECT
USING (public.can_access_quote(quote_id));
