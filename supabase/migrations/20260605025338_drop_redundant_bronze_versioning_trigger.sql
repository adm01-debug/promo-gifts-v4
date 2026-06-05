-- P2.8 JÁ EXISTIA via trg_spr_history/fn_spr_history. Remover minha duplicação para evitar
-- versionamento em dobro (dois INSERTs em history por mudança).
DROP TRIGGER IF EXISTS trg_version_supplier_raw ON public.supplier_products_raw;
DROP FUNCTION IF EXISTS public.fn_version_supplier_raw_on_hash_change();