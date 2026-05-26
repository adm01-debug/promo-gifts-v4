-- =================================================================
-- Onda 19 follow-up: rastrear funções de trigger + restaurar segurança da view
--
-- Contexto (PR #214 review items não resolvidos):
--
-- P1 (CodeRabbit) — fn_quotes_calc_real_values e fn_kit_print_area_normalizar_eixos
--   existiam apenas como drift de PROD; não estavam em nenhuma migration.
--   Em `supabase db reset` / novo ambiente, os triggers recriados pela Onda 19
--   falhariam com "function does not exist". Este migration registra as
--   definições exatas conforme extraído de PROD em 2026-05-15.
--
-- P1/P2 (Copilot + CodeRabbit) — DROP+RECREATE de v_audit_paradoxos_gravacao
--   na Onda 19 resetou `security_invoker` e grants: anon e authenticated
--   receberam acesso completo (confirmado via pg_class.relacl). A view é
--   classificada como "auditoria interna / service_role apenas" em
--   docs/redeploy/REDEPLOY-FASE2-EXECUTION-LOG.md — hardening revertido.
--
-- Padrão aplicado (idêntico a T15 e t34b):
--   ALTER VIEW ... SET (security_invoker = true)
--   REVOKE ALL ... FROM anon
--   REVOKE ALL ... FROM authenticated
-- =================================================================

BEGIN;

-- ----------------------------------------------------------------
-- 1. fn_quotes_calc_real_values
--    Trigger BEFORE em quotes: calcula real_subtotal e real_discount_percent
--    a partir do subtotal com markup já aplicado (negotiation_markup_percent).
--    Limite de markup: 0-50% (LEAST/GREATEST).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_quotes_calc_real_values()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_markup numeric;
BEGIN
  v_markup := LEAST(50, GREATEST(0, COALESCE(NEW.negotiation_markup_percent, 0)));
  NEW.negotiation_markup_percent := v_markup;

  IF v_markup > 0 THEN
    NEW.real_subtotal := ROUND(NEW.subtotal / (1 + v_markup / 100.0), 2);
  ELSE
    NEW.real_subtotal := NEW.subtotal;
  END IF;

  IF NEW.real_subtotal > 0 THEN
    NEW.real_discount_percent := ROUND(
      ((NEW.real_subtotal - (NEW.subtotal - COALESCE(NEW.discount_amount, 0))) / NEW.real_subtotal) * 100,
      2
    );
  ELSE
    NEW.real_discount_percent := 0;
  END IF;

  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION public.fn_quotes_calc_real_values() IS
  'Onda 19 follow-up: registra em migrations função que existia só como drift. '
  'Calcula real_subtotal e real_discount_percent a partir do subtotal COM markup; '
  'clamp markup 0-50%. Usada pelo trigger trg_quotes_calc_real_values.';

-- ----------------------------------------------------------------
-- 2. fn_kit_print_area_normalizar_eixos
--    Trigger BEFORE em kit_component_print_areas: arredonda max_width/max_height
--    a 2 casas decimais e garante largura >= altura (normalização de eixos).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_kit_print_area_normalizar_eixos()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_temp numeric;
BEGIN
  -- Arredondar a 2 casas decimais (resolução 1mm) - GAP #6
  IF NEW.max_width IS NOT NULL THEN
    NEW.max_width := ROUND(NEW.max_width::numeric, 2);
  END IF;
  IF NEW.max_height IS NOT NULL THEN
    NEW.max_height := ROUND(NEW.max_height::numeric, 2);
  END IF;

  -- Normalizar eixos: largura sempre >= altura - GAP #10
  IF NEW.max_height IS NOT NULL AND NEW.max_width IS NOT NULL
     AND NEW.max_height > NEW.max_width THEN
    v_temp        := NEW.max_width;
    NEW.max_width  := NEW.max_height;
    NEW.max_height := v_temp;
  END IF;

  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION public.fn_kit_print_area_normalizar_eixos() IS
  'Onda 19 follow-up: registra em migrations função que existia só como drift. '
  'Arredonda max_width/max_height a 2 casas e normaliza eixos (largura >= altura). '
  'Usada pelo trigger trg_kit_print_area_normalizar_eixos.';

-- ----------------------------------------------------------------
-- 3. Restaurar hardening de v_audit_paradoxos_gravacao
--    A Onda 19 fez DROP + CREATE OR REPLACE que resetou reloptions e ACL.
--    pg_class.relacl pós-Onda19 confirmou: anon e authenticated com acesso total.
--    View é interna/service_role-only (REDEPLOY-FASE2-EXECUTION-LOG.md).
-- ----------------------------------------------------------------
DO $g$ BEGIN
  IF to_regclass('public.v_audit_paradoxos_gravacao') IS NOT NULL THEN
    ALTER VIEW public.v_audit_paradoxos_gravacao SET (security_invoker = true);

    REVOKE ALL ON public.v_audit_paradoxos_gravacao FROM anon;
    REVOKE ALL ON public.v_audit_paradoxos_gravacao FROM authenticated;
  END IF;
END $g$;

COMMIT;
