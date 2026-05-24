-- ============================================================
-- GIFTS STORE - RLS COM ORGANIZATIONS (MULTI-TENANT)
-- Aplica Row Level Security baseado em Organizations
-- Data: 03/01/2025
-- ============================================================
-- Guard: this entire migration is wrapped in a DO block so it
-- exits cleanly when public.organizations doesn't exist yet.
-- On a fresh Supabase Preview Branch that replays all migrations
-- from scratch, organizations is created later in the sequence.
-- ============================================================

DO $outer$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    RAISE NOTICE 'Migration 20250103_02_rls_organizations skipped: public.organizations does not exist yet.';
    RETURN;
  END IF;

  -- ============================================================
  -- PARTE 1: ADICIONAR organization_id NAS TABELAS PRINCIPAIS
  -- ============================================================

  ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_categories_org ON public.categories(organization_id);

  ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers(organization_id);

  ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);

  ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_quotes_org ON public.quotes(organization_id);

  ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_orders_org ON public.orders(organization_id);

  ALTER TABLE public.bitrix_clients
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_bitrix_clients_org ON public.bitrix_clients(organization_id);

  ALTER TABLE public.mockup_generation_jobs
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_mockup_jobs_org ON public.mockup_generation_jobs(organization_id);

  ALTER TABLE public.collections
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_collections_org ON public.collections(organization_id);

  -- ============================================================
  -- PARTE 2: FUNÇÃO HELPER - Verificar se user pertence à org
  -- ============================================================

  CREATE OR REPLACE FUNCTION public.user_is_org_member(org_id UUID)
  RETURNS BOOLEAN AS $fn$
  BEGIN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_organizations
      WHERE organization_id = org_id
        AND user_id = auth.uid()
    );
  END;
  $fn$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

  -- ============================================================
  -- PARTE 3: APLICAR RLS EM TODAS AS TABELAS
  -- ============================================================

  ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
  END IF;
  ALTER TABLE public.bitrix_clients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.mockup_generation_jobs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.generated_mockups ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.personalization_techniques ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

  -- ============================================================
  -- PARTE 4: POLICIES - CATEGORIES
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_categories" ON public.categories;
  CREATE POLICY "org_members_view_categories"
    ON public.categories FOR SELECT TO authenticated
    USING (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_admins_create_categories" ON public.categories;
  CREATE POLICY "org_admins_create_categories"
    ON public.categories FOR INSERT TO authenticated
    WITH CHECK (public.is_org_owner_or_admin(organization_id));

  DROP POLICY IF EXISTS "org_admins_update_categories" ON public.categories;
  CREATE POLICY "org_admins_update_categories"
    ON public.categories FOR UPDATE TO authenticated
    USING (public.is_org_owner_or_admin(organization_id))
    WITH CHECK (public.is_org_owner_or_admin(organization_id));

  DROP POLICY IF EXISTS "org_admins_delete_categories" ON public.categories;
  CREATE POLICY "org_admins_delete_categories"
    ON public.categories FOR DELETE TO authenticated
    USING (public.is_org_owner_or_admin(organization_id));

  -- ============================================================
  -- PARTE 5: POLICIES - SUPPLIERS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_suppliers" ON public.suppliers;
  CREATE POLICY "org_members_view_suppliers"
    ON public.suppliers FOR SELECT TO authenticated
    USING (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_admins_manage_suppliers" ON public.suppliers;
  CREATE POLICY "org_admins_manage_suppliers"
    ON public.suppliers FOR ALL TO authenticated
    USING (public.is_org_owner_or_admin(organization_id))
    WITH CHECK (public.is_org_owner_or_admin(organization_id));

  -- ============================================================
  -- PARTE 6: POLICIES - PRODUCTS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_products" ON public.products;
  CREATE POLICY "org_members_view_products"
    ON public.products FOR SELECT TO authenticated
    USING (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_admins_manage_products" ON public.products;
  CREATE POLICY "org_admins_manage_products"
    ON public.products FOR ALL TO authenticated
    USING (public.is_org_owner_or_admin(organization_id))
    WITH CHECK (public.is_org_owner_or_admin(organization_id));

  -- ============================================================
  -- PARTE 7: POLICIES - PRODUCT_VARIANTS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_variants" ON public.product_variants;
  CREATE POLICY "org_members_view_variants"
    ON public.product_variants FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE id = product_variants.product_id
          AND public.user_is_org_member(organization_id)
      )
    );

  DROP POLICY IF EXISTS "org_admins_manage_variants" ON public.product_variants;
  CREATE POLICY "org_admins_manage_variants"
    ON public.product_variants FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE id = product_variants.product_id
          AND public.is_org_owner_or_admin(organization_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE id = product_variants.product_id
          AND public.is_org_owner_or_admin(organization_id)
      )
    );

  -- ============================================================
  -- PARTE 8: POLICIES - QUOTES
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_quotes" ON public.quotes;
  CREATE POLICY "org_members_view_quotes"
    ON public.quotes FOR SELECT TO authenticated
    USING (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_members_create_quotes" ON public.quotes;
  CREATE POLICY "org_members_create_quotes"
    ON public.quotes FOR INSERT TO authenticated
    WITH CHECK (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_members_update_own_quotes" ON public.quotes;
  CREATE POLICY "org_members_update_own_quotes"
    ON public.quotes FOR UPDATE TO authenticated
    USING (
      public.user_is_org_member(organization_id)
      AND (created_by = auth.uid() OR public.is_org_admin(organization_id))
    );

  DROP POLICY IF EXISTS "org_admins_delete_quotes" ON public.quotes;
  CREATE POLICY "org_admins_delete_quotes"
    ON public.quotes FOR DELETE TO authenticated
    USING (public.is_org_owner_or_admin(organization_id));

  -- ============================================================
  -- PARTE 9: POLICIES - QUOTE_ITEMS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_quote_items" ON public.quote_items;
  CREATE POLICY "org_members_view_quote_items"
    ON public.quote_items FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.quotes
        WHERE id = quote_items.quote_id
          AND public.user_is_org_member(organization_id)
      )
    );

  DROP POLICY IF EXISTS "org_members_manage_quote_items" ON public.quote_items;
  CREATE POLICY "org_members_manage_quote_items"
    ON public.quote_items FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.quotes
        WHERE id = quote_items.quote_id
          AND (created_by = auth.uid() OR public.is_org_admin(organization_id))
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.quotes
        WHERE id = quote_items.quote_id
          AND public.user_is_org_member(organization_id)
      )
    );

  -- ============================================================
  -- PARTE 10: POLICIES - ORDERS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_orders" ON public.orders;
  CREATE POLICY "org_members_view_orders"
    ON public.orders FOR SELECT TO authenticated
    USING (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_members_create_orders" ON public.orders;
  CREATE POLICY "org_members_create_orders"
    ON public.orders FOR INSERT TO authenticated
    WITH CHECK (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_members_update_own_orders" ON public.orders;
  CREATE POLICY "org_members_update_own_orders"
    ON public.orders FOR UPDATE TO authenticated
    USING (
      public.user_is_org_member(organization_id)
      AND (created_by = auth.uid() OR public.is_org_admin(organization_id))
    );

  DROP POLICY IF EXISTS "org_admins_delete_orders" ON public.orders;
  CREATE POLICY "org_admins_delete_orders"
    ON public.orders FOR DELETE TO authenticated
    USING (public.is_org_owner_or_admin(organization_id));

  -- ============================================================
  -- PARTE 11: POLICIES - ORDER_ITEMS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_order_items" ON public.order_items;
  CREATE POLICY "org_members_view_order_items"
    ON public.order_items FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_items.order_id
          AND public.user_is_org_member(organization_id)
      )
    );

  DROP POLICY IF EXISTS "org_members_manage_order_items" ON public.order_items;
  CREATE POLICY "org_members_manage_order_items"
    ON public.order_items FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_items.order_id
          AND (created_by = auth.uid() OR public.is_org_admin(organization_id))
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_items.order_id
          AND public.user_is_org_member(organization_id)
      )
    );

  -- ============================================================
  -- PARTE 12: POLICIES - PAYMENTS (guarded: table may not exist yet)
  -- ============================================================

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
    DROP POLICY IF EXISTS "org_members_view_payments" ON public.payments;
    CREATE POLICY "org_members_view_payments"
      ON public.payments FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.orders
          WHERE id = payments.order_id
            AND public.user_is_org_member(organization_id)
        )
      );

    DROP POLICY IF EXISTS "org_admins_manage_payments" ON public.payments;
    CREATE POLICY "org_admins_manage_payments"
      ON public.payments FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.orders
          WHERE id = payments.order_id
            AND public.is_org_admin(organization_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.orders
          WHERE id = payments.order_id
            AND public.user_is_org_member(organization_id)
        )
      );
  END IF;

  -- ============================================================
  -- PARTE 13: POLICIES - BITRIX_CLIENTS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_clients" ON public.bitrix_clients;
  CREATE POLICY "org_members_view_clients"
    ON public.bitrix_clients FOR SELECT TO authenticated
    USING (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_admins_manage_clients" ON public.bitrix_clients;
  CREATE POLICY "org_admins_manage_clients"
    ON public.bitrix_clients FOR ALL TO authenticated
    USING (public.is_org_owner_or_admin(organization_id))
    WITH CHECK (public.is_org_owner_or_admin(organization_id));

  -- ============================================================
  -- PARTE 14: POLICIES - MOCKUPS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_mockup_jobs" ON public.mockup_generation_jobs;
  CREATE POLICY "org_members_view_mockup_jobs"
    ON public.mockup_generation_jobs FOR SELECT TO authenticated
    USING (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_members_create_mockup_jobs" ON public.mockup_generation_jobs;
  CREATE POLICY "org_members_create_mockup_jobs"
    ON public.mockup_generation_jobs FOR INSERT TO authenticated
    WITH CHECK (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_members_view_generated_mockups" ON public.generated_mockups;
  CREATE POLICY "org_members_view_generated_mockups"
    ON public.generated_mockups FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.mockup_generation_jobs
        WHERE id = generated_mockups.job_id
          AND public.user_is_org_member(organization_id)
      )
    );

  -- ============================================================
  -- PARTE 15: POLICIES - COLLECTIONS
  -- ============================================================

  DROP POLICY IF EXISTS "org_members_view_collections" ON public.collections;
  CREATE POLICY "org_members_view_collections"
    ON public.collections FOR SELECT TO authenticated
    USING (public.user_is_org_member(organization_id));

  DROP POLICY IF EXISTS "org_admins_manage_collections" ON public.collections;
  CREATE POLICY "org_admins_manage_collections"
    ON public.collections FOR ALL TO authenticated
    USING (public.is_org_owner_or_admin(organization_id))
    WITH CHECK (public.is_org_owner_or_admin(organization_id));

  -- ============================================================
  -- PARTE 16: POLICIES - PERSONALIZATION_TECHNIQUES (GLOBAL)
  -- ============================================================

  DROP POLICY IF EXISTS "anyone_view_techniques" ON public.personalization_techniques;
  CREATE POLICY "anyone_view_techniques"
    ON public.personalization_techniques FOR SELECT TO authenticated
    USING (is_active = true);

  DROP POLICY IF EXISTS "admins_manage_techniques" ON public.personalization_techniques;
  CREATE POLICY "admins_manage_techniques"
    ON public.personalization_techniques FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_organizations
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    );

  -- ============================================================
  -- PARTE 17: POLICIES - NOTIFICATIONS (USER-SCOPED)
  -- ============================================================

  DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
  CREATE POLICY "users_view_own_notifications"
    ON public.notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid());

  DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
  CREATE POLICY "users_update_own_notifications"
    ON public.notifications FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

  -- ============================================================
  -- PARTE 18: POLICIES - SYSTEM TABLES (ADMIN ONLY)
  -- ============================================================

  DROP POLICY IF EXISTS "admins_view_feature_flags" ON public.feature_flags;
  CREATE POLICY "admins_view_feature_flags"
    ON public.feature_flags FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_organizations
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    );

  DROP POLICY IF EXISTS "admins_manage_system_settings" ON public.system_settings;
  CREATE POLICY "admins_manage_system_settings"
    ON public.system_settings FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_organizations
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    );

  -- ============================================================
  -- PARTE 19: GRANTS
  -- ============================================================

  GRANT SELECT ON public.categories TO authenticated;
  GRANT SELECT ON public.suppliers TO authenticated;
  GRANT SELECT ON public.products TO authenticated;
  GRANT SELECT ON public.quotes TO authenticated;
  GRANT SELECT ON public.orders TO authenticated;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
    GRANT SELECT ON public.payments TO authenticated;
  END IF;

  RAISE NOTICE 'Migration 20250103_02_rls_organizations applied successfully.';
END $outer$;
