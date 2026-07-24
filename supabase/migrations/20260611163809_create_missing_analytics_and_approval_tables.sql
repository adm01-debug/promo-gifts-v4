-- Migration: create missing analytics and approval tables
-- Tables referenced in code but absent from DB:
--   navigation_analytics, product_views, discount_approval_requests
--
-- navigation_analytics: schema matches what useNavigationAnalytics.ts inserts
-- (event_type + event_data jsonb — NOT the older button_name/source_path columns)

-- 1. navigation_analytics
CREATE TABLE IF NOT EXISTS public.navigation_analytics (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  event_data  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.navigation_analytics ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.navigation_analytics TO authenticated;
GRANT ALL   ON public.navigation_analytics TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'navigation_analytics'
      AND policyname = 'Users can insert own navigation events'
  ) THEN
    CREATE POLICY "Users can insert own navigation events"
      ON public.navigation_analytics FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. product_views
CREATE TABLE IF NOT EXISTS public.product_views (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   TEXT,
  product_sku  TEXT,
  product_name TEXT,
  seller_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  view_type    TEXT        NOT NULL DEFAULT 'detail',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_views'
      AND policyname = 'Users can insert own views'
  ) THEN
    CREATE POLICY "Users can insert own views"
      ON public.product_views FOR INSERT TO authenticated
      WITH CHECK (seller_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_views'
      AND policyname = 'Users can read own views'
  ) THEN
    CREATE POLICY "Users can read own views"
      ON public.product_views FOR SELECT TO authenticated
      USING (seller_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_views'
      AND policyname = 'Admins can read all views'
  ) THEN
    CREATE POLICY "Admins can read all views"
      ON public.product_views FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 3. discount_approval_requests
CREATE TABLE IF NOT EXISTS public.discount_approval_requests (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id                    UUID        NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  seller_id                   UUID        NOT NULL,
  requested_discount_percent  NUMERIC     NOT NULL,
  max_allowed_percent         NUMERIC     NOT NULL,
  status                      TEXT        NOT NULL DEFAULT 'pending',
  admin_id                    UUID,
  admin_notes                 TEXT,
  seller_notes                TEXT,
  responded_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_approval_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'discount_approval_requests'
      AND policyname = 'Admins can manage all approval requests'
  ) THEN
    CREATE POLICY "Admins can manage all approval requests"
      ON public.discount_approval_requests FOR ALL TO authenticated
      USING     (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'discount_approval_requests'
      AND policyname = 'Sellers can read own approval requests'
  ) THEN
    CREATE POLICY "Sellers can read own approval requests"
      ON public.discount_approval_requests FOR SELECT TO authenticated
      USING (seller_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'discount_approval_requests'
      AND policyname = 'Sellers can insert own approval requests'
  ) THEN
    CREATE POLICY "Sellers can insert own approval requests"
      ON public.discount_approval_requests FOR INSERT TO authenticated
      WITH CHECK (seller_id = auth.uid());
  END IF;
END $$;

-- Auto-update updated_at on discount_approval_requests
CREATE OR REPLACE FUNCTION public.update_discount_approval_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_discount_approval_updated_at'
      AND tgrelid = 'public.discount_approval_requests'::regclass
  ) THEN
    CREATE TRIGGER trg_discount_approval_updated_at
      BEFORE UPDATE ON public.discount_approval_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_discount_approval_updated_at();
  END IF;
END $$;
