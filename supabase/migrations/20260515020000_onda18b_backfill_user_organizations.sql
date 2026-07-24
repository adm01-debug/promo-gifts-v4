-- =================================================================
-- Onda 18b: Backfill user_organizations (defensivo + observabilidade)
--
-- Contexto: 4 dos 8 usuarios em user_roles NAO estavam em user_organizations,
-- entre eles joaquim@ (admin/PO). Sem entrada em user_organizations, o user
-- nao consegue ver NENHUM orcamento (user_is_org_member retorna FALSE).
--
-- Gap pre-existente, descoberto durante validacao da Onda 18a.
--
-- Hardening (CodeRabbit review):
--   - Lookup defensivo da organization por name (era UUID hardcoded)
--   - RAISE NOTICE se org nao existir em replay limpo (evita FK falsa)
--   - RAISE NOTICE com contagem de rows inseridas (observability)
--   - Idempotencia mantida via ON CONFLICT DO NOTHING + NOT EXISTS guard
--
-- Mapeamento app_role -> org_role:
--   - dev / admin -> org 'admin'
--   - vendedor / agente / supervisor / manager / coordenador -> org 'member'
-- =================================================================

DO $$
DECLARE
  _org_id    uuid;
  _org_name  text := 'Promobrind';
  _inserted  integer;
BEGIN
  -- Lookup defensivo: encontrar a org pela name (nao por UUID hardcoded)
  SELECT id INTO _org_id
  FROM public.organizations
  WHERE name = _org_name
  LIMIT 1;

  IF _org_id IS NULL THEN
    RAISE NOTICE
      'Onda 18b: Organization "%" not found in public.organizations. Skipping production backfill during clean replay.',
      _org_name;
    RETURN;
  END IF;

  -- Insert idempotente com contagem de rows inseridas
  WITH ins AS (
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    SELECT
      ur.user_id,
      _org_id,
      CASE
        WHEN ur.role::text IN ('dev','admin') THEN 'admin'::org_role
        ELSE 'member'::org_role
      END AS role
    FROM public.user_roles ur
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.user_id = ur.user_id
        AND uo.organization_id = _org_id
    )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO _inserted FROM ins;

  RAISE NOTICE
    'Onda 18b: % new user_organizations rows inserted into org "%" (id=%). Idempotent via ON CONFLICT DO NOTHING.',
    _inserted, _org_name, _org_id;
END $$;
