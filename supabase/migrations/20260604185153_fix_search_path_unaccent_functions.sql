-- ============================================================
-- Corrige search_path das ÚNICAS 2 funções que usam unaccent() sem 'extensions'
-- no caminho de busca. unaccent vive no schema 'extensions'; ~50 funções irmãs já
-- têm search_path='public, extensions'. Estas duas foram esquecidas.
--
-- products_search_vector_update: trigger trg_products_search_vector em products.
--   Sem search_path, ao ser disparada sob fn_process_raw_v2 (search_path=public),
--   não resolve unaccent() e ABORTA todo INSERT/UPDATE de products vindo do pipeline.
--   (Bug latente: derrubaria qualquer importação Spot real, não só o dry-run.)
-- fn_safe_bool: protegida por EXCEPTION, mas cai no fallback sem acento toda vez;
--   alinhada por consistência.
-- ============================================================
ALTER FUNCTION public.products_search_vector_update() SET search_path = public, extensions;
ALTER FUNCTION public.fn_safe_bool(text)            SET search_path = public, extensions;

-- ROLLBACK:
--   ALTER FUNCTION public.products_search_vector_update() RESET search_path;
--   ALTER FUNCTION public.fn_safe_bool(text) RESET search_path;
-- ============================================================