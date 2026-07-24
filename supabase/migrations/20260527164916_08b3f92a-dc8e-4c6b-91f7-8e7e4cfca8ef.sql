-- Insert default price freshness threshold setting if it doesn't exist
INSERT INTO public.system_settings (key, value, description)
VALUES ('default_price_freshness_threshold', '60', 'Default threshold in days for product price freshness warning')
ON CONFLICT (key) DO NOTHING;

-- Grant access to authenticated users to read system_settings if they don't have it
-- Assuming system_settings already has RLS and grants, but let's be sure about reading.
GRANT SELECT ON public.system_settings TO authenticated;
