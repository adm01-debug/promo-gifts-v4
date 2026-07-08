-- ═══════════════════════════════════════════════════════════════════════
-- Security fixes — findings de scan (2026-07-08)
--   1) can_view_all_sales() escalando acesso a todo autenticado
--   2) quote_items policy sem checagem de dono
--   3) conversation_event_history policy sem checagem de dono
--   4) system_settings com policies USING true que anulam a whitelist
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1) can_view_all_sales() ─────────────────────────────────────────
-- Antes: SELECT _user_id IS NOT NULL  → qualquer autenticado = TRUE
-- Depois: só admin/dev/supervisor/manager. Mantém assinatura para não
-- quebrar as policies quote_items_*_scope, quotes_*_scope, orders_*_scope
-- que já chamam esta função.
CREATE OR REPLACE FUNCTION public.can_view_all_sales(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    _user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role = ANY (ARRAY['admin'::app_role, 'dev'::app_role, 'supervisor'::app_role, 'manager'::app_role])
    ),
    false
  );
$$;

-- ─── 2) quote_items · policy permissiva ─────────────────────────────
-- A policy "Acesso a itens via orcamento" só verificava que existia a
-- quote-pai, sem checar dono. Como policies são OR-ed, ela anulava as
-- restritas quote_items_*_scope. As restritas já cobrem o acesso legítimo
-- (dono, supervisor da org, admin via can_view_all_sales), então basta
-- remover a permissiva.
DROP POLICY IF EXISTS "Acesso a itens via orcamento" ON public.quote_items;

-- ─── 3) conversation_event_history · adicionar checagem de dono ─────
DROP POLICY IF EXISTS "Acesso ao histórico de eventos segue o log de auditoria"
  ON public.conversation_event_history;

CREATE POLICY "Acesso ao histórico de eventos segue o log de auditoria"
  ON public.conversation_event_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_audit_logs cal
      WHERE cal.id = conversation_event_history.conversation_id
        AND (
          cal.user_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'dev'::app_role)
        )
    )
  );

-- ─── 4) system_settings · remover policies USING true ───────────────
-- Ambas expunham TODAS as chaves para qualquer autenticado, bypassando
-- a whitelist "Permitir leitura pública de configurações básicas".
DROP POLICY IF EXISTS "Everyone can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings readable by authenticated" ON public.system_settings;

-- Autenticados sem role especial passam a ler apenas via a policy
-- whitelist já existente ("Permitir leitura pública de configurações
-- básicas", role public/authenticated, key IN (maintenance_mode,
-- app_version, public_announcement)). Admins/devs/supervisores mantêm
-- acesso total via "Acesso total para administradores" (FOR ALL).