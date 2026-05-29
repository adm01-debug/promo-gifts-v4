ALTER TABLE public.navigation_analytics ADD COLUMN destination_path TEXT;

COMMENT ON COLUMN public.navigation_analytics.destination_path IS 'The intended destination of the navigation (e.g., "/" or "previous_page").';