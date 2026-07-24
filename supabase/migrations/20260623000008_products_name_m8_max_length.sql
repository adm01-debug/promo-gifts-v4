-- M8: CHECK constraint length(name) <= 250
-- Max atual = 183 chars. Limit 250 eh 36% acima do pior caso real.
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_name_max_length CHECK (length(name) <= 250) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_name_max_length;
