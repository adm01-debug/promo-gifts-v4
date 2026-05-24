-- =================================================================
-- Onda 20: Fix t38 RLS regression + bilateral SECURITY DEFINER gate
--
-- Contexto:
--   PR #192 (migration t38_deploy_hardening_final) aplicou
--   princípio do menor privilégio sem checar uso: revogou EXECUTE
--   de is_admin_or_above(uuid) e is_coord_or_above(uuid) do role
--   'authenticated'. Mas essas funções são chamadas em 83+29 RLS
--   policies por usuários authenticated, então toda operação
--   logada quebrou com `42501: permission denied for function ...`.
--
--   Adicionalmente, migration 20260514000000 criou
--   org_has_any_members(uuid) sem REVOKE FROM PUBLIC/anon — gate
--   audit_security_definer_acl() começou a falhar.
--
-- Causa raiz dupla:
--   1. Erro humano em t38: REVOKE indevido em funções RLS helper.
--   2. Erro arquitetural: gate atual é unilateral — detecta
--      excesso de privilégio (PUBLIC, anon), mas não detecta
--      CARÊNCIA (função SECURITY DEFINER em policy sem EXECUTE
--      pra authenticated). Por isso t38 passou pré-merge.
--
-- O que esta migration faz:
--   1. RE-GRANT is_admin_or_above e is_coord_or_above pra authenticated
--      (desbloqueia 112 policies imediatamente)
--   2. REVOKE org_has_any_members de PUBLIC e anon
--      (mantém authenticated + service_role; policy precisa)
--   3. Reescreve audit_security_definer_acl() com 4 categorias:
--      a) PUBLIC has EXECUTE
--      b) anon EXECUTE fora da whitelist
--      c) trigger function com EXECUTE pra authenticated
--      d) NOVO: SECURITY DEFINER citada em pg_policy sem EXECUTE
--               pra authenticated (RLS quebra com 42501)
--   4. RAISE EXCEPTION fail-fast se sobrar violação ao final
--      (rollback automático garante atomicidade)
--
-- Padrão documentado em docs/SECURITY-DEFINER-PATTERN.md
-- =================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. RE-GRANT funções quebradas pelo t38 (Bloco 1 da t38)
-- ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_admin_or_above(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coord_or_above(_user_id uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 2. REVOKE excesso em org_has_any_members
--    (criada por 20260514000000 com default PUBLIC do PostgreSQL)
-- ─────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.org_has_any_members(_org_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.org_has_any_members(_org_id uuid) FROM anon;

-- -----------------------------------------------------------------
-- 2.1. REVOKE excesso em helpers sensiveis criados por reconcile prod
--      antes do gate fail-fast. Migrations posteriores tambem endurecem
--      parte desses helpers, mas Onda 20 precisa validar o estado aqui.
-- -----------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.vault_delete_secret(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.vault_delete_secret(text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.vault_delete_secret(text) TO service_role, postgres;
  END IF;

  IF to_regprocedure('public.vault_get_secret(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.vault_get_secret(text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.vault_get_secret(text) TO service_role, postgres;
  END IF;

  IF to_regprocedure('public.vault_list_secret_names()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.vault_list_secret_names() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.vault_list_secret_names() TO service_role, postgres;
  END IF;

  IF to_regprocedure('public.vault_set_secret(text,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.vault_set_secret(text, text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.vault_set_secret(text, text, text) TO service_role, postgres;
  END IF;

  IF to_regprocedure('public.verify_step_up_password(uuid,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.verify_step_up_password(uuid, text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.verify_step_up_password(uuid, text) TO authenticated;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 3. Gate bilateral: reescreve audit_security_definer_acl()
--    para também reportar funções em policy sem EXECUTE pra
--    authenticated (Caso 4).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_security_definer_acl()
RETURNS TABLE(
  function_name TEXT,
  arguments TEXT,
  problem TEXT,
  granted_to TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  WITH defs AS (
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args,
      p.proacl,
      (pg_get_function_result(p.oid) = 'trigger') AS is_trigger,
      -- whitelist de funções intencionalmente acessíveis a anon
      (p.proname IN ('submit_quote_response', 'get_quote_token_by_value')) AS public_intent
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  ),
  acl_expanded AS (
    SELECT
      d.oid,
      d.proname,
      d.args,
      d.is_trigger,
      d.public_intent,
      a.grantee::regrole::text AS grantee
    FROM defs d
    LEFT JOIN LATERAL (
      SELECT (aclexplode(d.proacl)).grantee
    ) a ON true
    WHERE a.grantee IS NOT NULL
  ),
  -- funções SECURITY DEFINER citadas em pg_policy (qual ou with_check)
  -- regex \m...\M = word boundary, evita falso positivo (is_admin vs is_admin_or_above)
  policy_uses AS (
    SELECT DISTINCT d.oid, d.proname, d.args
    FROM defs d
    JOIN pg_policies pp
      ON pp.schemaname = 'public'
      AND (
        COALESCE(pp.qual, '')       ~ ('\m' || d.proname || '\M')
        OR COALESCE(pp.with_check, '') ~ ('\m' || d.proname || '\M')
      )
  )
  -- Caso 1: PUBLIC EXECUTE (sempre proibido)
  SELECT proname, args, 'PUBLIC has EXECUTE'::text, 'PUBLIC'::text
  FROM acl_expanded
  WHERE grantee = '-'
  UNION ALL
  -- Caso 2: anon EXECUTE fora da whitelist
  SELECT proname, args, 'anon has EXECUTE (not in public-intent whitelist)'::text, 'anon'
  FROM acl_expanded
  WHERE grantee = 'anon' AND NOT public_intent
  UNION ALL
  -- Caso 3: trigger function com EXECUTE pra authenticated (sem sentido)
  SELECT proname, args, 'trigger function has EXECUTE for authenticated'::text, 'authenticated'
  FROM acl_expanded
  WHERE grantee = 'authenticated' AND is_trigger
  UNION ALL
  -- Caso 4 (NOVO — Onda 20): usada em policy mas authenticated sem EXECUTE
  --   Caller authenticated falha com `42501: permission denied for function`
  --   ao avaliar a RLS policy. Detecta o anti-padrão que quebrou prod
  --   via PR #192 (t38).
  SELECT
    pu.proname,
    pu.args,
    'used in RLS policy but missing EXECUTE for authenticated (RLS will fail with 42501)'::text,
    'authenticated (MISSING)'::text
  FROM policy_uses pu
  WHERE NOT EXISTS (
    SELECT 1 FROM acl_expanded a
    WHERE a.oid = pu.oid AND a.grantee = 'authenticated'
  )
  ORDER BY 1, 2;
$$;

COMMENT ON FUNCTION public.audit_security_definer_acl() IS
'Audit gate bilateral: detecta 4 anti-padrões em funções SECURITY DEFINER de public. (1) PUBLIC EXECUTE; (2) anon EXECUTE fora da whitelist (submit_quote_response, get_quote_token_by_value); (3) trigger function com EXECUTE pra authenticated; (4) função citada em pg_policy SEM EXECUTE pra authenticated (RLS quebra em runtime com 42501 — Caso adicionado em Onda 20 após PR #192/t38 regression). Lints Supabase 0028/0029. Usado por scripts/check-security-definer-acl.mjs. Ver docs/SECURITY-DEFINER-PATTERN.md.';

GRANT EXECUTE ON FUNCTION public.audit_security_definer_acl() TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- 4. Fail-fast: rollback se sobrar violação após cirurgia
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count int;
  v_violations text;
BEGIN
  SELECT count(*) INTO v_count FROM public.audit_security_definer_acl();

  IF v_count > 0 THEN
    SELECT string_agg(
      format('  - %s(%s) | %s [%s]', function_name, arguments, problem, granted_to),
      E'\n'
    ) INTO v_violations
    FROM public.audit_security_definer_acl();

    RAISE EXCEPTION E'Onda 20: % violação(ões) SECURITY DEFINER restantes após cirurgia:\n%\nVer docs/SECURITY-DEFINER-PATTERN.md',
      v_count, v_violations;
  END IF;

  RAISE NOTICE 'Onda 20: SECURITY DEFINER ACL gate limpo (0 violações).';
END $$;
