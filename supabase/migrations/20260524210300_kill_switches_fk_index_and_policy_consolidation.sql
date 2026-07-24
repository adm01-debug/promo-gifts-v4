-- system_kill_switches: índice de FK ausente + consolidação de policies (colapso 2026-05-24, fase E).
--
-- Advisors:
--   * performance/unindexed_foreign_keys → system_kill_switches.updated_by sem índice.
--   * performance/multiple_permissive_policies (6x, SELECT) → `kill_switches_read_all`
--     (FOR SELECT, public, true) coexiste com `kill_switches_write_admin` (FOR ALL),
--     cujo USING `is_admin_or_above(...)` também é avaliado em SELECT.
--
-- Risco real além do advisor: a edge `_shared/kill_switch.ts` lê esta tabela com a
-- chave anon. Como `anon` NÃO tem EXECUTE em is_admin_or_above, avaliar essa policy
-- num SELECT anônimo pode falhar com "permission denied" — e, sendo fail-open, o
-- kill-switch nunca detectaria o estado OFF (mesmo bug da policy profiles_select).
--
-- Correção: a policy de admin passa a valer só para escrita (INSERT/UPDATE/DELETE)
-- e só para `authenticated`. O SELECT público (read_all) continua como única policy
-- de leitura. service_role escreve via BYPASSRLS, sem depender destas policies.

-- 1) Índice de FK
CREATE INDEX IF NOT EXISTS idx_system_kill_switches_updated_by
  ON public.system_kill_switches (updated_by);

-- 2) Consolidação de policies (DROP IF EXISTS antes de cada CREATE p/ replay
--    idempotente: em prod as policies admin já existem)
DROP POLICY IF EXISTS kill_switches_write_admin ON public.system_kill_switches;

DROP POLICY IF EXISTS kill_switches_insert_admin ON public.system_kill_switches;
CREATE POLICY kill_switches_insert_admin
  ON public.system_kill_switches FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_above((SELECT auth.uid())));

DROP POLICY IF EXISTS kill_switches_update_admin ON public.system_kill_switches;
CREATE POLICY kill_switches_update_admin
  ON public.system_kill_switches FOR UPDATE TO authenticated
  USING (public.is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (public.is_admin_or_above((SELECT auth.uid())));

DROP POLICY IF EXISTS kill_switches_delete_admin ON public.system_kill_switches;
CREATE POLICY kill_switches_delete_admin
  ON public.system_kill_switches FOR DELETE TO authenticated
  USING (public.is_admin_or_above((SELECT auth.uid())));
