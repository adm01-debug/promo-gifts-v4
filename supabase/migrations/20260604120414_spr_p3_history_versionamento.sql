
-- Histórico append-only: bronze fica imutável "no tempo" sem perder o estado atual.
-- Registra cada versão quando o content_hash muda (preço/estoque/etc.).
CREATE TABLE IF NOT EXISTS public.supplier_products_raw_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id uuid NOT NULL REFERENCES public.supplier_products_raw(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  supplier_reference varchar NOT NULL,
  content_hash text NOT NULL,
  raw_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spr_hist_ref ON public.supplier_products_raw_history (supplier_id, supplier_reference, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_spr_hist_raw ON public.supplier_products_raw_history (raw_id);
COMMENT ON TABLE public.supplier_products_raw_history IS
  'Histórico append-only do bronze. Uma linha por versão (content_hash distinto) de cada variante. Alimenta análise de tendência (preço/estoque) e mantém o bronze imutável no tempo.';

CREATE OR REPLACE FUNCTION public.fn_spr_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    INSERT INTO public.supplier_products_raw_history(raw_id, supplier_id, supplier_reference, content_hash, raw_data)
    VALUES (NEW.id, NEW.supplier_id, NEW.supplier_reference, NEW.content_hash, NEW.raw_data);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_spr_history ON public.supplier_products_raw;
CREATE TRIGGER trg_spr_history AFTER INSERT OR UPDATE ON public.supplier_products_raw
FOR EACH ROW EXECUTE FUNCTION public.fn_spr_history();

-- Seed da baseline (estado atual = v1 de cada variante)
INSERT INTO public.supplier_products_raw_history(raw_id, supplier_id, supplier_reference, content_hash, raw_data, captured_at)
SELECT id, supplier_id, supplier_reference, content_hash, raw_data, COALESCE(imported_at, now())
FROM public.supplier_products_raw;
