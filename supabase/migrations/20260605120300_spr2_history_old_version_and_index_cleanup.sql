-- ============================================================================
-- supplier_products_raw — Refactor v2 (Fase 4/5): Histórico temporal + índices
-- ----------------------------------------------------------------------------
--   * Histórico: hoje a trigger grava em TODO INSERT, gerando _history 1:1 com
--     o bronze (16.508 linhas, 32 MB) sem nenhuma versão real capturada. Passa
--     a registrar apenas a versão SUPERSEDIDA (OLD) quando o content_hash muda.
--     A própria linha bronze é a v1; _history guarda só o que foi substituído
--     (padrão temporal correto, sem duplicar a v1 e sem write-amplification).
--   * idx_spr_reference: 1 MB, ~15 scans. Lookups por supplier_reference já
--     vêm escopados por supplier_id (cobertos por uq_supplier_product_raw).
--   * idx_spr_hist_ref: sinalizado como índice não utilizado pelo advisor.
-- ============================================================================

-- 1) Histórico append-only passa a capturar a versão antiga em UPDATE
CREATE OR REPLACE FUNCTION public.fn_spr_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Captura apenas versões SUPERSEDIDAS (OLD) quando o conteúdo muda.
  -- O INSERT inicial não é duplicado: a própria linha bronze é a v1.
  IF NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    INSERT INTO public.supplier_products_raw_history
      (raw_id, supplier_id, supplier_reference, content_hash, raw_data)
    VALUES (OLD.id, OLD.supplier_id, OLD.supplier_reference, OLD.content_hash, OLD.raw_data);
  END IF;
  RETURN NULL;
END;
$function$;

-- Trigger só em UPDATE (o INSERT deixa de duplicar a v1 no histórico)
DROP TRIGGER IF EXISTS trg_spr_history ON public.supplier_products_raw;
CREATE TRIGGER trg_spr_history
  AFTER UPDATE ON public.supplier_products_raw
  FOR EACH ROW EXECUTE FUNCTION public.fn_spr_history();

-- 2) Índices de baixo/zero valor
DROP INDEX IF EXISTS public.idx_spr_reference;
DROP INDEX IF EXISTS public.idx_spr_hist_ref;
