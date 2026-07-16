-- PERF: Consolidate multiple permissive RLS policies into single OR-ed policies
-- lint=0006_multiple_permissive_policies WARN — 10 combos across 9 tables
--
-- Multiple PERMISSIVE policies for the same (table, role, cmd) are OR-ed by
-- Postgres, forcing evaluation of every policy per row. A single policy with
-- an explicit OR condition is semantically identical but incurs only one
-- policy evaluation per row, reducing planner overhead significantly.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

-- ─── catalog_analytics — SELECT authenticated ─────────────────────────────────
-- Merges: managers_read_all_catalog_analytics + users_read_own_analytics

DROP POLICY IF EXISTS managers_read_all_catalog_analytics ON public.catalog_analytics;
DROP POLICY IF EXISTS users_read_own_analytics             ON public.catalog_analytics;
CREATE POLICY catalog_analytics_read ON public.catalog_analytics
  FOR SELECT TO authenticated
  USING (
    is_manager_or_admin()
    OR (SELECT auth.uid()) = user_id
  );

-- ─── magazine_public_view_events (parent) — SELECT authenticated ──────────────
-- Merges: view_events_read_admin + view_events_read_owner

DROP POLICY IF EXISTS view_events_read_admin ON public.magazine_public_view_events;
DROP POLICY IF EXISTS view_events_read_owner ON public.magazine_public_view_events;
CREATE POLICY view_events_read ON public.magazine_public_view_events
  FOR SELECT TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.magazines m
      WHERE m.id = magazine_public_view_events.magazine_id
        AND m.owner_id = (SELECT auth.uid())
    )
  );

-- ─── magazine_public_view_events partitions — SELECT authenticated ────────────

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'magazine_public_view_events_2026_07',
    'magazine_public_view_events_2026_08',
    'magazine_public_view_events_2026_09',
    'magazine_public_view_events_2026_10',
    'magazine_public_view_events_default'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS view_events_read_admin ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS view_events_read_owner ON public.%I', t);
    EXECUTE format(
      $fmt$
      CREATE POLICY view_events_read ON public.%I
        FOR SELECT TO authenticated
        USING (
          has_role((SELECT auth.uid()), 'admin'::app_role)
          OR EXISTS (
            SELECT 1 FROM public.magazines m
            WHERE m.id = %I.magazine_id
              AND m.owner_id = (SELECT auth.uid())
          )
        )
      $fmt$,
      t, t
    );
  END LOOP;
END;
$do$;

-- ─── magazines — ALL authenticated ────────────────────────────────────────────
-- Merges: magazines_admin_all + magazines_owner_all
-- USING: owner check includes deleted_at guard; admin check does not
-- WITH CHECK: owner check allows inserts (no deleted_at); admin check allows all

DROP POLICY IF EXISTS magazines_admin_all ON public.magazines;
DROP POLICY IF EXISTS magazines_owner_all ON public.magazines;
CREATE POLICY magazines_all ON public.magazines
  FOR ALL TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR ((owner_id = (SELECT auth.uid())) AND (deleted_at IS NULL))
  )
  WITH CHECK (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR (owner_id = (SELECT auth.uid()))
  );

-- ─── product_views — SELECT authenticated ─────────────────────────────────────
-- Merges: "Admins can read all views" + "Users can read own views"

DROP POLICY IF EXISTS "Admins can read all views" ON public.product_views;
DROP POLICY IF EXISTS "Users can read own views"  ON public.product_views;
CREATE POLICY product_views_read ON public.product_views
  FOR SELECT TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR (seller_id = (SELECT auth.uid()))
  );

-- ─── smoke_test_runs — INSERT authenticated ───────────────────────────────────
-- smoke_insert_service_role (fixed in 000012) covers: service_role JWT OR admin
-- smoke_test_runs_insert_admin is a strict subset — drop it to eliminate
-- the multiple-policy overhead on every INSERT

DROP POLICY IF EXISTS smoke_test_runs_insert_admin ON public.smoke_test_runs;

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_still_multiple integer;
BEGIN
  SELECT count(*) INTO v_still_multiple
  FROM (
    SELECT tablename, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'catalog_analytics',
        'magazine_public_view_events',
        'magazine_public_view_events_2026_07',
        'magazine_public_view_events_2026_08',
        'magazine_public_view_events_2026_09',
        'magazine_public_view_events_2026_10',
        'magazine_public_view_events_default',
        'magazines',
        'product_views',
        'smoke_test_runs'
      )
      AND permissive = 'PERMISSIVE'
    GROUP BY tablename, cmd, roles
    HAVING count(*) > 1
  ) dup;

  IF v_still_multiple > 0 THEN
    RAISE EXCEPTION 'multiple_permissive_policies fix FAILED — % combos still have multiple permissive policies', v_still_multiple;
  END IF;

  RAISE NOTICE 'Consolidated multiple permissive policies — 10 combos across 9 tables resolved';
END;
$$;
