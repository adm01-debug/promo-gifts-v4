CREATE TABLE IF NOT EXISTS public.sales_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('monthly', 'weekly', 'quarterly')),
  target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_quotes INTEGER NOT NULL DEFAULT 0,
  current_quotes INTEGER NOT NULL DEFAULT 0,
  target_conversions INTEGER NOT NULL DEFAULT 0,
  current_conversions INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_achieved BOOLEAN NOT NULL DEFAULT FALSE,
  achieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- Idempotente: a tabela já existe em produção (criada por uma migração de
-- timestamp diferente), então em preview-branches a policy já está presente.
-- Um CREATE POLICY cru falharia com "policy already exists" e derrubaria o
-- deploy do branch. O guard pg_policies cria só se ausente, sem tocar policies
-- já existentes (inclusive variantes endurecidas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'sales_goals'
      AND policyname = 'Users can manage own goals'
  ) THEN
    CREATE POLICY "Users can manage own goals"
      ON public.sales_goals
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_goals' AND column_name IN ('user_id')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_sales_goals_user_id ON public.sales_goals(user_id);
  END IF;
END $$;
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_goals' AND column_name IN ('start_date','end_date')) = 2 THEN
    CREATE INDEX IF NOT EXISTS idx_sales_goals_date_range ON public.sales_goals(start_date, end_date);
  END IF;
END $$;
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_goals' AND column_name IN ('user_id','start_date','end_date')) = 3 THEN
    CREATE INDEX IF NOT EXISTS idx_sales_goals_user_active ON public.sales_goals(user_id, start_date, end_date) WHERE NOT is_achieved;
  END IF;
END $$;
