-- Create a table for visual search feedback
CREATE TABLE IF NOT EXISTS public.visual_search_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid(),
    image_url TEXT,
    original_analysis JSONB NOT NULL,
    corrected_analysis JSONB,
    search_terms TEXT,
    is_correct BOOLEAN DEFAULT TRUE,
    feedback_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.visual_search_feedback TO authenticated;
GRANT ALL ON public.visual_search_feedback TO service_role;

-- Enable RLS
ALTER TABLE public.visual_search_feedback ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'visual_search_feedback' AND policyname = 'Users can view their own feedback'
  ) THEN
    CREATE POLICY "Users can view their own feedback" 
ON public.visual_search_feedback FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'visual_search_feedback' AND policyname = 'Users can insert their own feedback'
  ) THEN
    CREATE POLICY "Users can insert their own feedback" 
ON public.visual_search_feedback FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
