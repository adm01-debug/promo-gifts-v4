-- ================================================================
-- Bulk REVOKE write grants em TODAS as views public existentes
-- ================================================================
-- Supabase DEFAULT PRIVILEGES concede INSERT/UPDATE/DELETE/REFERENCES/TRIGGER
-- automaticamente a anon e authenticated em todo novo VIEW criado.
-- O event trigger evt_revoke_view_write_grants protege criações FUTURAS.
-- Esta migration limpa as 161 views EXISTENTES com write grants.
-- ================================================================
DO $$
DECLARE
  v_view text;
  v_count integer := 0;
  v_errors integer := 0;
BEGIN
  FOR v_view IN
    SELECT DISTINCT table_name
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('INSERT','UPDATE','DELETE','REFERENCES','TRIGGER')
      AND table_name IN (
        SELECT viewname FROM pg_views WHERE schemaname = 'public'
      )
    ORDER BY table_name
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated',
        v_view
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'bulk_revoke_views: could not revoke on %: %', v_view, SQLERRM;
      v_errors := v_errors + 1;
    END;
  END LOOP;
  RAISE NOTICE 'bulk_revoke_views: % views cleaned, % errors', v_count, v_errors;
END;
$$;

NOTIFY pgrst, 'reload schema';
