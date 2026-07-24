-- =============================================================================
-- FIX-005: user_roles — Prevent privilege escalation (manager -> dev)
-- Bug: is_admin_or_above() includes 'manager', allowing them to grant 'dev' role
-- Applied: 2026-05-26
-- =============================================================================

DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;

CREATE POLICY user_roles_insert_guarded
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    CASE
      WHEN role = 'dev'::app_role
        THEN is_dev((SELECT auth.uid()))
      ELSE (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.role IN ('dev', 'supervisor', 'admin')
        )
      )
    END
  );

CREATE POLICY user_roles_update_guarded
  ON public.user_roles FOR UPDATE TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (
    CASE
      WHEN role = 'dev'::app_role
        THEN is_dev((SELECT auth.uid()))
      ELSE (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.role IN ('dev', 'supervisor', 'admin')
        )
      )
    END
  );

CREATE POLICY user_roles_delete_guarded
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    CASE
      WHEN role = 'dev'::app_role
        THEN is_dev((SELECT auth.uid()))
      ELSE is_admin_or_above((SELECT auth.uid()))
    END
  );
