-- =============================================================================
-- FIX: Restaurar products.category_name (BUG 400 em quoteService.ts:98)
-- Root cause: migrações 20260519163704 e 20260519164522 registradas com
-- statements:[] — ALTER TABLE nunca executou em produção.
-- Impacto: GET /products?select=id,category_id,category_name → HTTP 400
-- Detectado via console do browser em 2026-06-25.
-- Validado: 7/7 checks PASS, trigger funcional, zero divergências.
-- =============================================================================

-- PASSO 1: Adicionar coluna (idempotente)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_name TEXT;

COMMENT ON COLUMN public.products.category_name IS
  'Cache desnormalizado de categories.name via category_id. '
  'Mantido sincronizado por trg_sync_product_category_name. '
  'Restaurado em 2026-06-25 após migrations 20260519163704/164522 '
  'não terem executado em produção (statements:[]).';

-- PASSO 2: Backfill completo (IS DISTINCT FROM = idempotente)
UPDATE public.products p
SET category_name = c.name
FROM public.categories c
WHERE c.id = p.category_id
  AND p.category_name IS DISTINCT FROM c.name;

-- PASSO 3: Trigger function para manter sincronizado
CREATE OR REPLACE FUNCTION public.fn_sync_product_category_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NULL THEN
    NEW.category_name := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR (NEW.category_id IS DISTINCT FROM OLD.category_id) THEN
    SELECT name INTO NEW.category_name
    FROM public.categories
    WHERE id = NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_sync_product_category_name() IS
  'Mantém products.category_name sincronizado com categories.name '
  'quando category_id muda. Instalado por migration 20260625000001.';

-- PASSO 4: Instalar trigger
DROP TRIGGER IF EXISTS trg_sync_product_category_name ON public.products;
CREATE TRIGGER trg_sync_product_category_name
  BEFORE INSERT OR UPDATE OF category_id
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_product_category_name();

-- PASSO 5: Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
