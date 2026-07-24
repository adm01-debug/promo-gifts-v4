-- View v_kill_switch_hits_summary herda GRANT SELECT TO anon via default privs.
-- Revogar explicitamente para que não apareça no GraphQL schema do anon.
REVOKE SELECT ON public.v_kill_switch_hits_summary FROM anon;

-- Verificar
SELECT
  has_table_privilege('anon', 'public.v_kill_switch_hits_summary', 'SELECT') AS anon_select_view,
  has_table_privilege('authenticated', 'public.v_kill_switch_hits_summary', 'SELECT') AS auth_select_view;
