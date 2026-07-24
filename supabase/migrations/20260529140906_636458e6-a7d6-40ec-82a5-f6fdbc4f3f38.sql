-- Create navigation_analytics table
CREATE TABLE IF NOT EXISTS public.navigation_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  button_name TEXT NOT NULL,
  source_path TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT INSERT ON public.navigation_analytics TO authenticated;
GRANT ALL ON public.navigation_analytics TO service_role;

-- Enable RLS
ALTER TABLE public.navigation_analytics ENABLE ROW LEVEL SECURITY;

-- Create policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'navigation_analytics' AND policyname = 'Users can insert their own navigation analytics'
  ) THEN
    CREATE POLICY "Users can insert their own navigation analytics"
ON public.navigation_analytics
FOR INSERT
WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
