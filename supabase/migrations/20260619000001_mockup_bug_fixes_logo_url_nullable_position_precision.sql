-- BUG-7 FIX: logo_url was NOT NULL, causing INSERT failure when logo storage upload
-- fails (uploadLogoToStorage returns null). Making it nullable lets us save the
-- mockup record even when the logo URL is unavailable, preserving the mockup_url.
ALTER TABLE public.generated_mockups
  ALTER COLUMN logo_url DROP NOT NULL;

-- BUG-6 FIX: position_x/y were INTEGER, silently truncating fractional % values
-- (e.g. positionX=50.5 → stored as 50). Switch to numeric(5,2) to preserve up to
-- two decimal places (0.00 – 100.00 covers any percentage with sub-pixel precision).
ALTER TABLE public.generated_mockups
  ALTER COLUMN position_x TYPE numeric(5,2) USING position_x::numeric(5,2),
  ALTER COLUMN position_y TYPE numeric(5,2) USING position_y::numeric(5,2);
