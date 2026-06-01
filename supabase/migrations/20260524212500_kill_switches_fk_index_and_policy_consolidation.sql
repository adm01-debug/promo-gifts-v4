CREATE INDEX IF NOT EXISTS idx_system_kill_switches_updated_by
  ON public.system_kill_switches (updated_by);

DROP POLICY IF EXISTS kill_switches_write_admin ON public.system_kill_switches;
DROP POLICY IF EXISTS kill_switches_insert_admin ON public.system_kill_switches;
DROP POLICY IF EXISTS kill_switches_update_admin ON public.system_kill_switches;
DROP POLICY IF EXISTS kill_switches_delete_admin ON public.system_kill_switches;

CREATE POLICY kill_switches_insert_admin
  ON public.system_kill_switches FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_above((SELECT auth.uid())));

CREATE POLICY kill_switches_update_admin
  ON public.system_kill_switches FOR UPDATE TO authenticated
  USING (public.is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (public.is_admin_or_above((SELECT auth.uid())));

CREATE POLICY kill_switches_delete_admin
  ON public.system_kill_switches FOR DELETE TO authenticated
  USING (public.is_admin_or_above((SELECT auth.uid())));
