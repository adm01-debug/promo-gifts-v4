ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_color_required
  CHECK (color_name IS NOT NULL AND length(btrim(color_name)) > 0)
  NOT VALID;