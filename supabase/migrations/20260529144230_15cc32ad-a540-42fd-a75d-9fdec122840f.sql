-- Ensure the preferences column exists (already checked via read_query)
-- and add catalog preferences to the schema for reference.

-- Create analytics table if it doesn't exist (defensive)
CREATE TABLE IF NOT EXISTS public.catalog_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.catalog_analytics TO authenticated;
GRANT ALL ON public.catalog_analytics TO service_role;

ALTER TABLE public.catalog_analytics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_analytics' AND policyname = 'Users can view their own catalog analytics'
  ) THEN
    CREATE POLICY "Users can view their own catalog analytics" 
ON public.catalog_analytics 
FOR SELECT 
USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_analytics' AND policyname = 'Users can insert their own catalog analytics'
  ) THEN
    CREATE POLICY "Users can insert their own catalog analytics" 
ON public.catalog_analytics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
