-- ============================================================================
-- HARDENING: create_organization_with_owner — REVOKE PUBLIC + limite por user
-- ============================================================================
--
-- CONTEXTO:
-- A função public.create_organization_with_owner foi criada em 19/mai 11:45
-- (migration 20260519114532) com SECURITY DEFINER mas SEM:
--   1. REVOKE EXECUTE FROM PUBLIC (todo authenticated podia chamar)
--   2. Limite de orgs por usuário (atacante criava N orgs sem cap)
--
-- A funcao internamente faz `IF auth.uid() IS NULL THEN RAISE EXCEPTION` o que
-- bloqueia anon. Mas:
--   - Estilisticamente fraco (Default GRANT TO PUBLIC + check interno)
--   - Qualquer usuario autenticado podia criar quantas organizacoes quisesse
--     (poluiçao de tabela, custo, possível abuso)
--
-- ESTE FIX:
--   1. REVOKE EXECUTE FROM PUBLIC + GRANT EXECUTE TO authenticated
--      (defensive layer alem do check de auth.uid())
--   2. Adicionar limite: max 5 organizacoes por usuario (configurable via const)
--   3. Validar slug nao-vazio e nao-conflito antes de INSERT (mensagem melhor)
--   4. Audit log via RAISE NOTICE em todos os caminhos
--
-- VALIDACAO: funcao recriada via CREATE OR REPLACE preservando:
--   - Assinatura (text, text) -> uuid
--   - SECURITY DEFINER
--   - SET search_path = public
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  _name text,
  _slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  current_user_id uuid;
  _existing_owner_count integer;
  _max_orgs_per_user constant integer := 5;
BEGIN
  -- 1. Autenticação obrigatória
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- 2. Validação de entrada
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name is required' USING ERRCODE = '22023';
  END IF;
  IF _slug IS NULL OR length(trim(_slug)) = 0 THEN
    RAISE EXCEPTION 'Organization slug is required' USING ERRCODE = '22023';
  END IF;

  -- 3. Limite: max N orgs por usuário (como owner)
  SELECT COUNT(*) INTO _existing_owner_count
  FROM public.organization_members
  WHERE user_id = current_user_id
    AND role = 'owner';

  IF _existing_owner_count >= _max_orgs_per_user THEN
    RAISE EXCEPTION 'Limite de % organizações por usuário atingido. Contate suporte para aumentar.', _max_orgs_per_user
      USING ERRCODE = '23514';
  END IF;

  -- 4. Conflito de slug: erro melhor que constraint genérica
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Slug "%" ja esta em uso. Escolha outro.', _slug
      USING ERRCODE = '23505';
  END IF;

  -- 5. Criar organização + membership atomicamente
  INSERT INTO public.organizations (name, slug)
  VALUES (trim(_name), trim(_slug))
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, current_user_id, 'owner');

  RAISE NOTICE '[create_organization_with_owner] User % created org % (slug: %)',
    current_user_id, new_org_id, _slug;

  RETURN new_org_id;
END;
$$;

-- 6. PERMISSIONS: lockdown explícito (defense in depth)
REVOKE EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;

COMMENT ON FUNCTION public.create_organization_with_owner(text, text) IS
'Cria organização + membership atomicamente. Limite: 5 orgs/usuario (owner). REQUER auth. SECURITY DEFINER com search_path=public. Hardened em 19/mai/2026.';
