CREATE TABLE IF NOT EXISTS public.personalization_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  client_name TEXT,
  product_id TEXT NOT NULL,
  product_name TEXT,
  product_sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  product_unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  simulation_data JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.personalization_simulations ENABLE ROW LEVEL SECURITY;

-- Idempotente (ver nota em 20260531110100): cria a policy só se ainda não
-- existir, evitando "policy already exists" em preview-branches baseados em prod.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'personalization_simulations'
      AND policyname = 'Sellers can manage own simulations'
  ) THEN
    CREATE POLICY "Sellers can manage own simulations"
      ON public.personalization_simulations
      FOR ALL
      USING (seller_id = auth.uid())
      WITH CHECK (seller_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='personalization_simulations' AND column_name IN ('seller_id')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_personalization_simulations_seller_id ON public.personalization_simulations(seller_id);
  END IF;
END $$;
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='personalization_simulations' AND column_name IN ('created_at')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_personalization_simulations_created_at ON public.personalization_simulations(created_at DESC);
  END IF;
END $$;
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='personalization_simulations' AND column_name IN ('product_id')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_personalization_simulations_product_id ON public.personalization_simulations(product_id);
  END IF;
END $$;
